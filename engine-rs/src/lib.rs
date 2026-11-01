//! Chess on Surfaces engine: Classical (flat), Cylinder, Bounce-sides, Bounce-all.
//! A port of www/js/engine.js: mailbox board, per-surface precomputed ray tables,
//! make/unmake, Zobrist hashing, transposition table, PVS + aspiration windows, RFP,
//! futility / late-move pruning, LMR, null move (not on Cylinder), killers + history,
//! quiescence with check evasions, mobility / king-zone / pawn-structure evaluation.
//!
//! Pieces: P N B R Q K = 1..6, black = +8.  Moves are i32: from | to<<6 | flag<<12
//! (flag 1 double push, 2 en passant, 3 castle king side, 4 castle queen side, 5..8 promote N B R Q).
//! Squares are y*8+x with y = 0 on black's back rank (rank 8).
#![allow(static_mut_refs)]
#![allow(clippy::needless_range_loop)]

#[link(wasm_import_module = "env")]
extern "C" {
    fn now_ms() -> f64;
}

const MATE: i32 = 30000;
const MATEB: i32 = 29000;
const MAXP: usize = 96;
const INF: i32 = 32000;
const STRIDE: usize = 1024;
const VAL: [i32; 7] = [0, 100, 320, 330, 500, 900, 0];
const PR: [i32; 8] = [0, 0, 6, 12, 22, 38, 64, 0];
const PP: [i32; 8] = [0, 0, 8, 16, 32, 60, 100, 0];
const DIRS: [(i32, i32); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];
const MW: [f32; 6] = [0.0, 0.0, 4.0, 3.0, 2.0, 1.0];
const ZW: [i32; 6] = [0, 0, 2, 2, 3, 5];
const KDANGER: [f32; 16] = [0.0, 0.0, 10.0, 25.0, 50.0, 80.0, 120.0, 160.0, 200.0, 240.0, 280.0, 300.0, 300.0, 300.0, 300.0, 300.0];
const TT_BITS: u32 = 20;
const TT_SIZE: usize = 1 << TT_BITS;
const TT_MASK: u32 = (TT_SIZE as u32) - 1;

// io buffer layout (i32 units)
const IO_LEN: usize = 48000;
const POS_LEN: usize = 68; // 64 board, stm, castling, ep, halfmove
const IN_HIST: usize = 72;
const OUT_MOVE: usize = 40000;
const OUT_CP: usize = 40001;
const OUT_DEPTH: usize = 40002;
const OUT_NODES: usize = 40003;
const OUT_N: usize = 40004;
const OUT_LIST: usize = 40010;

static mut IO: [i32; IO_LEN] = [0; IO_LEN];

macro_rules! at2 {
    ($a:expr, $i:expr, $j:expr) => {
        unsafe { *$a.get_unchecked($i as usize).get_unchecked($j as usize) }
    };
}
macro_rules! at {
    ($a:expr, $i:expr) => {
        unsafe { *$a.get_unchecked($i as usize) }
    };
}

// ---------------------------------------------------------------- geometry
// mode: 0 flat, 1 cylinder, 2 bounce sides, 3 bounce all
fn step_f(m: u8, x: i32, y: i32, dx: i32, dy: i32) -> i32 {
    let mut nx = x + dx;
    let ny = y + dy;
    if nx < 0 || nx > 7 {
        if m != 1 {
            return -1;
        }
        nx = (nx + 8) % 8;
    }
    if ny < 0 || ny > 7 {
        return -1;
    }
    ny * 8 + nx
}

fn adv_f(m: u8, x: i32, y: i32, dx: i32, dy: i32) -> Option<(i32, i32, i32, i32)> {
    if m != 2 && m != 3 {
        let r = step_f(m, x, y, dx, dy);
        return if r < 0 { None } else { Some((r & 7, r >> 3, dx, dy)) };
    }
    let (mut dx, mut dy) = (dx, dy);
    let mut nx = x + dx;
    let mut ny = y + dy;
    if nx < 0 || nx > 7 {
        if dy == 0 {
            return None;
        }
        dx = -dx;
        nx = x + dx;
    }
    if ny < 0 || ny > 7 {
        if m == 2 || dx == 0 {
            return None;
        }
        dy = -dy;
        ny = y + dy;
    }
    Some((nx, ny, dx, dy))
}

struct Tbl {
    ray: [[u8; 40]; 512],
    rl: [u8; 512],
    kn: [[u8; 8]; 64],
    knl: [u8; 64],
    kg: [[u8; 8]; 64],
    kgl: [u8; 64],
    pf: [[i8; 64]; 2],
    pd: [[i8; 64]; 2],
    pc: [[[u8; 2]; 64]; 2],
    pcl: [[u8; 64]; 2],
    pa: [[[u8; 2]; 64]; 2],
    pal: [[u8; 64]; 2],
    mobb: [f32; 7],
}

fn build(m: u8) -> Box<Tbl> {
    let mut t = Box::new(Tbl {
        ray: [[0; 40]; 512],
        rl: [0; 512],
        kn: [[0; 8]; 64],
        knl: [0; 64],
        kg: [[0; 8]; 64],
        kgl: [0; 64],
        pf: [[-1; 64]; 2],
        pd: [[-1; 64]; 2],
        pc: [[[0; 2]; 64]; 2],
        pcl: [[0; 64]; 2],
        pa: [[[0; 2]; 64]; 2],
        pal: [[0; 64]; 2],
        mobb: [0.0; 7],
    });
    for sq in 0..64usize {
        let x = (sq & 7) as i32;
        let y = (sq >> 3) as i32;
        for d in 0..8usize {
            let (mut cx, mut cy, mut ex, mut ey) = (x, y, DIRS[d].0, DIRS[d].1);
            let mut l = 0usize;
            for _ in 0..40 {
                match adv_f(m, cx, cy, ex, ey) {
                    None => break,
                    Some((a, b, c, e)) => {
                        cx = a;
                        cy = b;
                        ex = c;
                        ey = e;
                        if cx == x && cy == y {
                            break;
                        }
                        t.ray[sq * 8 + d][l] = (cy * 8 + cx) as u8;
                        l += 1;
                    }
                }
            }
            t.rl[sq * 8 + d] = l as u8;
        }
        // knights
        let mut kn: Vec<u8> = Vec::new();
        for &(a, c) in &[(2, 1), (1, 2)] {
            for &sx in &[-1, 1] {
                for &sy in &[-1, 1] {
                    let mut cx = x;
                    let mut ok = true;
                    for _ in 0..a {
                        let r = step_f(m, cx, y, sx, 0);
                        if r < 0 {
                            ok = false;
                            break;
                        }
                        cx = r & 7;
                    }
                    if !ok {
                        continue;
                    }
                    let ny = y + sy * c;
                    if !(0..=7).contains(&ny) {
                        continue;
                    }
                    let q = (ny * 8 + cx) as u8;
                    if !kn.contains(&q) {
                        kn.push(q);
                    }
                }
            }
        }
        for (i, q) in kn.iter().enumerate() {
            t.kn[sq][i] = *q;
        }
        t.knl[sq] = kn.len() as u8;
        // king
        let mut n = 0;
        for dx in -1..=1 {
            for dy in -1..=1 {
                if dx == 0 && dy == 0 {
                    continue;
                }
                let r = step_f(m, x, y, dx, dy);
                if r >= 0 {
                    t.kg[sq][n] = r as u8;
                    n += 1;
                }
            }
        }
        t.kgl[sq] = n as u8;
        // pawns
        for c in 0..2usize {
            let f = if c == 0 { -1 } else { 1 };
            let a = step_f(m, x, y, 0, f);
            t.pf[c][sq] = a as i8;
            if a >= 0 && y == (if c == 0 { 6 } else { 1 }) {
                let d2 = step_f(m, a & 7, a >> 3, 0, f);
                t.pd[c][sq] = d2 as i8;
            }
            let mut n = 0;
            for &dx in &[-1, 1] {
                let r = step_f(m, x, y, dx, f);
                if r >= 0 {
                    t.pc[c][sq][n] = r as u8;
                    n += 1;
                }
            }
            t.pcl[c][sq] = n as u8;
        }
    }
    for c in 0..2usize {
        for sq in 0..64usize {
            let mut n = 0;
            for q in 0..64usize {
                for j in 0..t.pcl[c][q] as usize {
                    if t.pc[c][q][j] as usize == sq && n < 2 {
                        t.pa[c][sq][n] = q as u8;
                        n += 1;
                        break;
                    }
                }
            }
            t.pal[c][sq] = n as u8;
        }
    }
    // average empty-board mobility per piece type
    let mut mb = [0f32; 7];
    let mut stamp = [0i32; 64];
    let mut st = 0;
    for sq in 0..64usize {
        mb[2] += t.knl[sq] as f32;
        for &(ty, d0, d1) in &[(3usize, 4usize, 8usize), (4, 0, 4), (5, 0, 8)] {
            st += 1;
            let mut c = 0;
            for d in d0..d1 {
                for i in 0..t.rl[sq * 8 + d] as usize {
                    let q = t.ray[sq * 8 + d][i] as usize;
                    if stamp[q] != st {
                        stamp[q] = st;
                        c += 1;
                    }
                }
            }
            mb[ty] += c as f32;
        }
    }
    for i in 2..=5 {
        mb[i] /= 64.0;
    }
    t.mobb = mb;
    t
}

#[derive(Clone, Copy, Default)]
struct TtE {
    k: u32,
    mv: i32,
    v: i16,
    d: i8,
    f: i8,
}

struct Eng {
    t: &'static Tbl,
    mode: u8,
    tbls: [Option<&'static Tbl>; 4],
    b: [i8; 64],
    cnt: [i8; 16],
    ksq: [usize; 2],
    stm: usize,
    cr: i32,
    ep: i32,
    hm: i32,
    h1: u32,
    h2: u32,
    sp: usize,
    u_cap: [i8; 2048],
    u_cr: [i8; 2048],
    u_ep: [i8; 2048],
    u_hm: [i16; 2048],
    u_h1: [u32; 2048],
    u_h2: [u32; 2048],
    u_mv: [i32; 2048],
    mv: Vec<i32>,
    sc: Vec<i32>,
    stamp: [i32; 64],
    stamp_n: i32,
    nodes: u32,
    abort: bool,
    t0: f64,
    tl: f64,
    root_best: i32,
    root_score: i32,
    tt: Vec<TtE>,
    kil: [[i32; 2]; MAXP + 8],
    hi: Vec<i32>,
    cfg: [i32; 5], // rfp, nmp, fut, lmp, lmr
    lmr: [[u8; 64]; 64],
    zp1: Vec<u32>,
    zp2: Vec<u32>,
    zs1: u32,
    zs2: u32,
    zc1: [u32; 16],
    zc2: [u32; 16],
    ze1: [u32; 65],
    ze2: [u32; 65],
    crm: [i32; 64],
    rng: u64,
}

static mut ENG: Option<Box<Eng>> = None;

fn eng() -> &'static mut Eng {
    unsafe {
        if ENG.is_none() {
            ENG = Some(Box::new(Eng::new()));
        }
        ENG.as_mut().unwrap()
    }
}

impl Eng {
    fn new() -> Eng {
        let t0: &'static Tbl = Box::leak(build(0));
        let mut zs: u32 = 0x9e3779b9;
        let mut zr = || {
            zs ^= zs << 13;
            zs ^= zs >> 17;
            zs ^= zs << 5;
            zs
        };
        let zs1 = zr();
        let zs2 = zr();
        let mut zp1 = vec![0u32; 1024];
        let mut zp2 = vec![0u32; 1024];
        for i in 0..1024 {
            zp1[i] = zr();
            zp2[i] = zr();
        }
        let mut zc1 = [0u32; 16];
        let mut zc2 = [0u32; 16];
        for i in 0..16 {
            zc1[i] = zr();
            zc2[i] = zr();
        }
        let mut ze1 = [0u32; 65];
        let mut ze2 = [0u32; 65];
        for i in 0..64 {
            ze1[i] = zr();
            ze2[i] = zr();
        }
        let mut lmr = [[0u8; 64]; 64];
        for d in 0..64usize {
            for i in 0..64usize {
                lmr[d][i] = if d < 3 || i < 2 { 0 } else { (0.7 + (d as f64).ln() * (i as f64).ln() / 2.3).floor() as u8 };
            }
        }
        let mut crm = [15i32; 64];
        crm[63] = 15 & !1;
        crm[56] = 15 & !2;
        crm[7] = 15 & !4;
        crm[0] = 15 & !8;
        let mut tbls: [Option<&'static Tbl>; 4] = [None; 4];
        tbls[0] = Some(t0);
        Eng {
            t: t0,
            mode: 0,
            tbls,
            b: [0; 64],
            cnt: [0; 16],
            ksq: [0; 2],
            stm: 0,
            cr: 0,
            ep: -1,
            hm: 0,
            h1: 0,
            h2: 0,
            sp: 0,
            u_cap: [0; 2048],
            u_cr: [0; 2048],
            u_ep: [0; 2048],
            u_hm: [0; 2048],
            u_h1: [0; 2048],
            u_h2: [0; 2048],
            u_mv: [0; 2048],
            mv: vec![0; (MAXP + 8) * STRIDE],
            sc: vec![0; (MAXP + 8) * STRIDE],
            stamp: [0; 64],
            stamp_n: 0,
            nodes: 0,
            abort: false,
            t0: 0.0,
            tl: 0.0,
            root_best: 0,
            root_score: 0,
            tt: vec![TtE::default(); TT_SIZE],
            kil: [[0; 2]; MAXP + 8],
            hi: vec![0; 4096],
            cfg: [1; 5],
            lmr,
            zp1,
            zp2,
            zs1,
            zs2,
            zc1,
            zc2,
            ze1,
            ze2,
            crm,
            rng: 0x2545F4914F6CDD1D,
        }
    }

    fn rnd(&mut self) -> f32 {
        // xorshift64*
        let mut x = self.rng;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.rng = x;
        ((x.wrapping_mul(0x2545F4914F6CDD1D) >> 40) as f32) / 16777216.0
    }

    fn set_mode(&mut self, m: u8) {
        if self.tbls[m as usize].is_none() {
            self.tbls[m as usize] = Some(Box::leak(build(m)));
        }
        self.cfg[1] = if m == 1 { 0 } else { 1 };
        self.mode = m;
        self.t = self.tbls[m as usize].unwrap();
    }

    // ------------------------------------------------------------ position
    fn set_pos(&mut self, off: usize) {
        let io = unsafe { &IO };
        self.b = [0; 64];
        self.cnt = [0; 16];
        for i in 0..64 {
            let p = io[off + i];
            self.b[i] = p as i8;
            if p != 0 {
                self.cnt[p as usize] += 1;
                if (p & 7) == 6 {
                    self.ksq[(p >> 3) as usize] = i;
                }
            }
        }
        self.stm = io[off + 64] as usize;
        self.cr = io[off + 65];
        self.ep = io[off + 66];
        self.hm = io[off + 67];
        self.sp = 0;
        self.rehash();
    }

    fn rehash(&mut self) {
        let mut h1 = 0u32;
        let mut h2 = 0u32;
        for i in 0..64 {
            let p = self.b[i] as usize;
            if p != 0 {
                h1 ^= self.zp1[p * 64 + i];
                h2 ^= self.zp2[p * 64 + i];
            }
        }
        if self.stm == 1 {
            h1 ^= self.zs1;
            h2 ^= self.zs2;
        }
        h1 ^= self.zc1[self.cr as usize];
        h2 ^= self.zc2[self.cr as usize];
        if self.ep >= 0 {
            h1 ^= self.ze1[self.ep as usize];
            h2 ^= self.ze2[self.ep as usize];
        }
        self.h1 = h1;
        self.h2 = h2;
    }

    #[inline]
    fn attacked(&self, sq: usize, by: usize) -> bool {
        let t = self.t;
        let b = &self.b;
        let pc = (1 + (by << 3)) as i8;
        for i in 0..at!(t.pal[by], sq) as usize {
            if at!(b, at2!(t.pa[by], sq, i)) == pc {
                return true;
            }
        }
        let nc = (2 + (by << 3)) as i8;
        for i in 0..at!(t.knl, sq) as usize {
            if at!(b, at2!(t.kn, sq, i)) == nc {
                return true;
            }
        }
        let kc = (6 + (by << 3)) as i8;
        for i in 0..at!(t.kgl, sq) as usize {
            if at!(b, at2!(t.kg, sq, i)) == kc {
                return true;
            }
        }
        let qc = (5 + (by << 3)) as i8;
        let rc = (4 + (by << 3)) as i8;
        let bc = (3 + (by << 3)) as i8;
        for d in 0..8usize {
            let pc2 = if d < 4 { rc } else { bc };
            let ri = sq * 8 + d;
            for i in 0..at!(t.rl, ri) as usize {
                let q = at!(b, at2!(t.ray, ri, i));
                if q != 0 {
                    if q == qc || q == pc2 {
                        return true;
                    }
                    break;
                }
            }
        }
        false
    }

    fn make(&mut self, m: i32) {
        let f = (m & 63) as usize;
        let t = ((m >> 6) & 63) as usize;
        let fl = m >> 12;
        let p = self.b[f];
        let us = self.stm;
        let cap = self.b[t];
        let sp = self.sp;
        self.u_cap[sp] = cap;
        self.u_cr[sp] = self.cr as i8;
        self.u_ep[sp] = self.ep as i8;
        self.u_hm[sp] = self.hm as i16;
        self.u_h1[sp] = self.h1;
        self.u_h2[sp] = self.h2;
        self.u_mv[sp] = m;
        self.sp += 1;
        self.h1 ^= self.zc1[self.cr as usize];
        self.h2 ^= self.zc2[self.cr as usize];
        if self.ep >= 0 {
            self.h1 ^= self.ze1[self.ep as usize];
            self.h2 ^= self.ze2[self.ep as usize];
        }
        let mut np = p;
        if fl >= 5 {
            np = ((fl - 3) + ((us as i32) << 3)) as i8;
        }
        self.b[f] = 0;
        self.h1 ^= self.zp1[p as usize * 64 + f];
        self.h2 ^= self.zp2[p as usize * 64 + f];
        if cap != 0 {
            self.h1 ^= self.zp1[cap as usize * 64 + t];
            self.h2 ^= self.zp2[cap as usize * 64 + t];
            self.cnt[cap as usize] -= 1;
        }
        self.b[t] = np;
        self.h1 ^= self.zp1[np as usize * 64 + t];
        self.h2 ^= self.zp2[np as usize * 64 + t];
        if np != p {
            self.cnt[p as usize] -= 1;
            self.cnt[np as usize] += 1;
        }
        self.ep = -1;
        if fl == 1 {
            self.ep = ((f + t) >> 1) as i32;
        } else if fl == 2 {
            let q = if us == 0 { t + 8 } else { t - 8 };
            let cp = self.b[q];
            self.b[q] = 0;
            self.h1 ^= self.zp1[cp as usize * 64 + q];
            self.h2 ^= self.zp2[cp as usize * 64 + q];
            self.cnt[cp as usize] -= 1;
            self.u_cap[sp] = cp;
        } else if fl == 3 || fl == 4 {
            let r = if us == 0 { 56 } else { 0 };
            let rf = if fl == 3 { r + 7 } else { r };
            let rt = if fl == 3 { r + 5 } else { r + 3 };
            let rk = self.b[rf];
            self.b[rf] = 0;
            self.b[rt] = rk;
            self.h1 ^= self.zp1[rk as usize * 64 + rf] ^ self.zp1[rk as usize * 64 + rt];
            self.h2 ^= self.zp2[rk as usize * 64 + rf] ^ self.zp2[rk as usize * 64 + rt];
        }
        if (p & 7) == 6 {
            self.ksq[us] = t;
            self.cr &= if us == 0 { !3 } else { !12 };
        }
        self.cr &= self.crm[f] & self.crm[t];
        self.hm = if (p & 7) == 1 || cap != 0 || fl == 2 { 0 } else { self.hm + 1 };
        self.h1 ^= self.zc1[self.cr as usize];
        self.h2 ^= self.zc2[self.cr as usize];
        if self.ep >= 0 {
            self.h1 ^= self.ze1[self.ep as usize];
            self.h2 ^= self.ze2[self.ep as usize];
        }
        self.stm ^= 1;
        self.h1 ^= self.zs1;
        self.h2 ^= self.zs2;
    }

    fn unmake(&mut self) {
        self.sp -= 1;
        let sp = self.sp;
        let m = self.u_mv[sp];
        let f = (m & 63) as usize;
        let t = ((m >> 6) & 63) as usize;
        let fl = m >> 12;
        self.stm ^= 1;
        let us = self.stm;
        let mut p = self.b[t];
        if fl >= 5 {
            self.cnt[p as usize] -= 1;
            p = (1 + (us << 3)) as i8;
            self.cnt[p as usize] += 1;
        }
        self.b[f] = p;
        let cap = self.u_cap[sp];
        if fl == 2 {
            self.b[t] = 0;
            let q = if us == 0 { t + 8 } else { t - 8 };
            self.b[q] = cap;
            self.cnt[cap as usize] += 1;
        } else {
            self.b[t] = cap;
            if cap != 0 {
                self.cnt[cap as usize] += 1;
            }
        }
        if fl == 3 || fl == 4 {
            let r = if us == 0 { 56 } else { 0 };
            let rf = if fl == 3 { r + 7 } else { r };
            let rt = if fl == 3 { r + 5 } else { r + 3 };
            self.b[rf] = self.b[rt];
            self.b[rt] = 0;
        }
        if (p & 7) == 6 {
            self.ksq[us] = f;
        }
        self.cr = self.u_cr[sp] as i32;
        self.ep = self.u_ep[sp] as i32;
        self.hm = self.u_hm[sp] as i32;
        self.h1 = self.u_h1[sp];
        self.h2 = self.u_h2[sp];
    }

    fn make_null(&mut self) {
        let sp = self.sp;
        self.u_cap[sp] = 0;
        self.u_cr[sp] = self.cr as i8;
        self.u_ep[sp] = self.ep as i8;
        self.u_hm[sp] = self.hm as i16;
        self.u_h1[sp] = self.h1;
        self.u_h2[sp] = self.h2;
        self.u_mv[sp] = 0;
        self.sp += 1;
        if self.ep >= 0 {
            self.h1 ^= self.ze1[self.ep as usize];
            self.h2 ^= self.ze2[self.ep as usize];
        }
        self.ep = -1;
        self.hm += 1;
        self.stm ^= 1;
        self.h1 ^= self.zs1;
        self.h2 ^= self.zs2;
    }

    fn unmake_null(&mut self) {
        self.sp -= 1;
        let sp = self.sp;
        self.stm ^= 1;
        self.cr = self.u_cr[sp] as i32;
        self.ep = self.u_ep[sp] as i32;
        self.hm = self.u_hm[sp] as i32;
        self.h1 = self.u_h1[sp];
        self.h2 = self.u_h2[sp];
    }

    // ------------------------------------------------------------ move generation
    fn gen(&mut self, ply: usize, caps: bool) -> usize {
        let base = ply * STRIDE;
        let mut n = 0usize;
        let us = self.stm;
        let t = self.t;
        macro_rules! push {
            ($v:expr) => {
                if n < STRIDE {
                    self.mv[base + n] = $v;
                    n += 1;
                }
            };
        }
        for sq in 0..64usize {
            let p = self.b[sq];
            if p == 0 || (p >> 3) as usize != us {
                continue;
            }
            let pt = p & 7;
            let sqi = sq as i32;
            if pt == 1 {
                let tt = t.pf[us][sq] as i32;
                if tt >= 0 && self.b[tt as usize] == 0 {
                    if tt < 8 || tt >= 56 {
                        push!(sqi | tt << 6 | 8 << 12);
                        if !caps {
                            push!(sqi | tt << 6 | 7 << 12);
                            push!(sqi | tt << 6 | 6 << 12);
                            push!(sqi | tt << 6 | 5 << 12);
                        }
                    } else if !caps {
                        push!(sqi | tt << 6);
                        let t2 = t.pd[us][sq] as i32;
                        if t2 >= 0 && self.b[t2 as usize] == 0 {
                            push!(sqi | t2 << 6 | 1 << 12);
                        }
                    }
                }
                for i in 0..t.pcl[us][sq] as usize {
                    let t2 = t.pc[us][sq][i] as i32;
                    let q = self.b[t2 as usize];
                    if q != 0 {
                        if (q >> 3) as usize != us {
                            if t2 < 8 || t2 >= 56 {
                                push!(sqi | t2 << 6 | 8 << 12);
                                push!(sqi | t2 << 6 | 7 << 12);
                                push!(sqi | t2 << 6 | 6 << 12);
                                push!(sqi | t2 << 6 | 5 << 12);
                            } else {
                                push!(sqi | t2 << 6);
                            }
                        }
                    } else if t2 == self.ep {
                        push!(sqi | t2 << 6 | 2 << 12);
                    }
                }
            } else if pt == 2 || pt == 6 {
                let (len, list) = if pt == 2 { (t.knl[sq], &t.kn[sq]) } else { (t.kgl[sq], &t.kg[sq]) };
                for i in 0..len as usize {
                    let tt = list[i] as i32;
                    let q = self.b[tt as usize];
                    if q == 0 {
                        if !caps {
                            push!(sqi | tt << 6);
                        }
                    } else if (q >> 3) as usize != us {
                        push!(sqi | tt << 6);
                    }
                }
            } else {
                self.stamp_n += 1;
                let sn = self.stamp_n;
                let (d0, d1) = if pt == 4 { (0, 4) } else if pt == 3 { (4, 8) } else { (0, 8) };
                for d in d0..d1 {
                    let ri = sq * 8 + d;
                    for i in 0..at!(t.rl, ri) as usize {
                        let tt = at2!(t.ray, ri, i) as usize;
                        let q = at!(self.b, tt);
                        if q == 0 {
                            if !caps && at!(self.stamp, tt) != sn {
                                unsafe { *self.stamp.get_unchecked_mut(tt) = sn };
                                push!(sqi | (tt as i32) << 6);
                            }
                        } else {
                            if (q >> 3) as usize != us && at!(self.stamp, tt) != sn {
                                unsafe { *self.stamp.get_unchecked_mut(tt) = sn };
                                push!(sqi | (tt as i32) << 6);
                            }
                            break;
                        }
                    }
                }
            }
        }
        if !caps && self.cr != 0 {
            let r: usize = if us == 0 { 56 } else { 0 };
            let k = (6 + (us << 3)) as i8;
            let rk = (4 + (us << 3)) as i8;
            if self.b[r + 4] == k && !self.attacked(r + 4, us ^ 1) {
                if (self.cr & (if us == 1 { 4 } else { 1 })) != 0
                    && self.b[r + 7] == rk
                    && self.b[r + 5] == 0
                    && self.b[r + 6] == 0
                    && !self.attacked(r + 5, us ^ 1)
                {
                    push!((r as i32 + 4) | (r as i32 + 6) << 6 | 3 << 12);
                }
                if (self.cr & (if us == 1 { 8 } else { 2 })) != 0
                    && self.b[r] == rk
                    && self.b[r + 1] == 0
                    && self.b[r + 2] == 0
                    && self.b[r + 3] == 0
                    && !self.attacked(r + 3, us ^ 1)
                {
                    push!((r as i32 + 4) | (r as i32 + 2) << 6 | 4 << 12);
                }
            }
        }
        n
    }

    // ------------------------------------------------------------ evaluation (side to move's view)
    fn evaluate(&mut self) -> i32 {
        let t = self.t;
        let cyl = self.mode == 1;
        let cnt = &self.cnt;
        let c = |i: usize| cnt[i] as i32;
        let mat = (c(2) + c(10)) * 320 + (c(3) + c(11)) * 330 + (c(4) + c(12)) * 500 + (c(5) + c(13)) * 900;
        let f = ((mat - 1000) as f32 / 2500.0).clamp(0.0, 1.0);
        let fdist = |a: i32, b: i32| -> i32 {
            let d = (a - b).abs();
            if !cyl {
                d
            } else {
                d.min(8 - d)
            }
        };
        let fcen = |x: i32, y: i32| -> f32 {
            (if !cyl { 3.5 - (x as f32 - 3.5).abs() } else { 1.5 }) + 3.5 - (y as f32 - 3.5).abs()
        };
        let mut pcnt = [[0i32; 8]; 2];
        let mut psq = [[0usize; 16]; 2];
        let mut pn = [0usize; 2];
        let mut zn = [[false; 64]; 2];
        let mut pat = [[false; 64]; 2];
        let mut ku = [0i32; 2];
        let mut s = [0f32; 2];
        for cc in 0..2 {
            let k = self.ksq[cc];
            zn[cc][k] = true;
            for i in 0..t.kgl[k] as usize {
                zn[cc][t.kg[k][i] as usize] = true;
            }
        }
        for i in 0..64usize {
            let p = self.b[i];
            if (p & 7) == 1 {
                let cc = (p >> 3) as usize;
                pcnt[cc][i & 7] += 1;
                if pn[cc] < 16 {
                    psq[cc][pn[cc]] = i;
                    pn[cc] += 1;
                }
                for j in 0..t.pcl[cc][i] as usize {
                    pat[cc][t.pc[cc][i][j] as usize] = true;
                }
            }
        }
        for cc in 0..2usize {
            let them = cc ^ 1;
            let mut v = 0f32;
            for n in 0..pn[cc] {
                let sq = psq[cc][n];
                let x = (sq & 7) as i32;
                let y = (sq >> 3) as i32;
                let r = (if cc == 0 { 7 - y } else { y }) as usize;
                v += (VAL[1] + PR[r]) as f32;
                if pcnt[cc][x as usize] > 1 {
                    v -= 8.0;
                }
                let mut iso = true;
                for &dx in &[-1, 1] {
                    let nx = if cyl { (x + dx + 8) % 8 } else { x + dx };
                    if (0..8).contains(&nx) && pcnt[cc][nx as usize] != 0 {
                        iso = false;
                    }
                }
                if iso {
                    v -= 10.0;
                }
                if pat[cc][sq] {
                    v += 4.0;
                }
                let mut pass = true;
                for j in 0..pn[them] {
                    let e = psq[them][j];
                    let ey = (e >> 3) as i32;
                    let er = (if cc == 0 { 7 - ey } else { ey }) as usize;
                    if fdist(x, (e & 7) as i32) <= 1 && er > r {
                        pass = false;
                        break;
                    }
                }
                if pass {
                    v += PP[r] as f32;
                }
            }
            s[cc] = v;
        }
        for sq in 0..64usize {
            let p = self.b[sq];
            if p == 0 {
                continue;
            }
            let pt = (p & 7) as usize;
            if pt == 1 || pt == 6 {
                continue;
            }
            let cc = (p >> 3) as usize;
            let them = cc ^ 1;
            let x = (sq & 7) as i32;
            let y = (sq >> 3) as i32;
            let r = if cc == 0 { 7 - y } else { y };
            let mut v = 0f32;
            let mut m = 0i32;
            if pt == 2 {
                for i in 0..t.knl[sq] as usize {
                    let tt = t.kn[sq][i] as usize;
                    let q = self.b[tt];
                    if (q != 0 && (q >> 3) as usize == cc) || pat[them][tt] {
                        continue;
                    }
                    m += 1;
                    if zn[them][tt] {
                        ku[cc] += ZW[2];
                    }
                }
                v += fcen(x, y) * 3.0 - if r == 0 { 10.0 } else { 0.0 };
            } else {
                self.stamp_n += 1;
                let sn = self.stamp_n;
                let (d0, d1) = if pt == 4 { (0, 4) } else if pt == 3 { (4, 8) } else { (0, 8) };
                for d in d0..d1 {
                    let ri = sq * 8 + d;
                    for i in 0..at!(t.rl, ri) as usize {
                        let tt = at2!(t.ray, ri, i) as usize;
                        let q = at!(self.b, tt);
                        if q != 0 && (q >> 3) as usize == cc {
                            break;
                        }
                        if at!(self.stamp, tt) != sn {
                            unsafe { *self.stamp.get_unchecked_mut(tt) = sn };
                            if pt != 5 && pat[them][tt] {
                            } else {
                                m += 1;
                                if zn[them][tt] {
                                    ku[cc] += ZW[pt];
                                }
                            }
                        }
                        if q != 0 {
                            break;
                        }
                    }
                }
                if pt == 3 {
                    v += fcen(x, y) * 1.5 - if r == 0 { 10.0 } else { 0.0 };
                } else if pt == 4 {
                    if pcnt[cc][x as usize] == 0 {
                        v += if pcnt[them][x as usize] != 0 { 8.0 } else { 16.0 };
                    }
                    if r == 6 {
                        v += 18.0;
                    }
                } else {
                    v += fcen(x, y) * 0.5;
                }
            }
            v += MW[pt] * (m as f32 - t.mobb[pt]);
            s[cc] += v;
        }
        for cc in 0..2usize {
            let sq = self.ksq[cc];
            let x = (sq & 7) as i32;
            let y = (sq >> 3) as i32;
            let r = if cc == 0 { 7 - y } else { y };
            let mut sh = 0;
            for n in 0..pn[cc] {
                let q = psq[cc][n];
                let qr = if cc == 0 { 7 - (q >> 3) as i32 } else { (q >> 3) as i32 };
                if qr == r + 1 && fdist(x, (q & 7) as i32) <= 1 {
                    sh += 1;
                }
            }
            s[cc] += f * (-(r as f32) * 14.0 + sh as f32 * 12.0 - KDANGER[(ku[cc ^ 1] as usize).min(15)]) + (1.0 - f) * fcen(x, y) * 9.0;
        }
        if c(3) > 1 {
            s[0] += 30.0;
        }
        if c(11) > 1 {
            s[1] += 30.0;
        }
        s[0] += (c(2) * 320 + c(3) * 330 + c(4) * 500 + c(5) * 900) as f32;
        s[1] += (c(10) * 320 + c(11) * 330 + c(12) * 500 + c(13) * 900) as f32;
        let d = s[0] - s[1];
        ((if self.stm == 0 { d } else { -d }) + 8.0) as i32
    }

    fn insuff(&self) -> bool {
        let c = &self.cnt;
        if c[1] != 0 || c[9] != 0 || c[4] != 0 || c[12] != 0 || c[5] != 0 || c[13] != 0 {
            return false;
        }
        let n = c[2] + c[10] + c[3] + c[11];
        if n == 0 {
            return true;
        }
        if self.mode != 0 {
            return false;
        }
        if n == 1 {
            return true;
        }
        if c[2] != 0 || c[10] != 0 {
            return false;
        }
        let mut col: i32 = -1;
        for i in 0..64usize {
            if (self.b[i] & 7) == 3 {
                let cc = (((i & 7) + (i >> 3)) & 1) as i32;
                if col < 0 {
                    col = cc;
                } else if cc != col {
                    return false;
                }
            }
        }
        n <= 6
    }

    fn is_rep(&self) -> bool {
        let lim = (self.hm.max(0) as usize).min(self.sp);
        let mut i = 2;
        while i <= lim {
            if self.u_h1[self.sp - i] == self.h1 && self.u_h2[self.sp - i] == self.h2 {
                return true;
            }
            i += 2;
        }
        false
    }

    // ------------------------------------------------------------ search
    fn score_moves(&mut self, ply: usize, n: usize, ttm: i32) {
        let base = ply * STRIDE;
        let k0 = self.kil[ply][0];
        let k1 = self.kil[ply][1];
        for i in 0..n {
            let m = self.mv[base + i];
            let f = (m & 63) as usize;
            let t = ((m >> 6) & 63) as usize;
            let fl = m >> 12;
            let q = self.b[t];
            self.sc[base + i] = if m == ttm {
                1_000_000_000
            } else if fl >= 5 {
                if fl == 8 {
                    20_000_000
                } else {
                    -1_000_000 + fl
                }
            } else if q != 0 || fl == 2 {
                10_000_000 + VAL[((if q != 0 { q } else { 1 }) & 7) as usize] * 16 - (self.b[f] & 7) as i32
            } else if m == k0 {
                9_000_000
            } else if m == k1 {
                8_900_000
            } else {
                self.hi[f * 64 + t]
            };
        }
    }

    #[inline]
    fn pick(&mut self, ply: usize, n: usize, i: usize) -> i32 {
        let base = ply * STRIDE;
        let mut bi = i;
        let mut bs = self.sc[base + i];
        for j in i + 1..n {
            if self.sc[base + j] > bs {
                bs = self.sc[base + j];
                bi = j;
            }
        }
        if bi != i {
            self.mv.swap(base + i, base + bi);
            self.sc.swap(base + i, base + bi);
        }
        self.mv[base + i]
    }

    #[inline]
    fn tick(&mut self) {
        self.nodes += 1;
        if (self.nodes & 2047) == 0 && unsafe { now_ms() } - self.t0 > self.tl {
            self.abort = true;
        }
    }

    fn qs(&mut self, mut alpha: i32, beta: i32, ply: usize, qd: i32) -> i32 {
        self.tick();
        if self.abort {
            return 0;
        }
        let us = self.stm;
        let in_chk = self.attacked(self.ksq[us], us ^ 1);
        let mut stand = -INF;
        if !in_chk {
            stand = self.evaluate();
            if stand >= beta {
                return stand;
            }
            if stand > alpha {
                alpha = stand;
            }
            if qd <= 0 || ply >= MAXP - 2 {
                return stand;
            }
        } else if qd <= -4 || ply >= MAXP - 2 {
            return self.evaluate();
        }
        let n = self.gen(ply, !in_chk);
        self.score_moves(ply, n, 0);
        let mut legal = 0;
        let mut best = stand;
        for i in 0..n {
            let m = self.pick(ply, n, i);
            let fl = m >> 12;
            if !in_chk && fl < 5 && fl != 2 {
                let cp = self.b[((m >> 6) & 63) as usize];
                if stand + VAL[((if cp != 0 { cp } else { 1 }) & 7) as usize] + 200 < alpha {
                    continue;
                }
            }
            self.make(m);
            if self.attacked(self.ksq[us], us ^ 1) {
                self.unmake();
                continue;
            }
            legal += 1;
            let v = -self.qs(-beta, -alpha, ply + 1, qd - 1);
            self.unmake();
            if self.abort {
                return 0;
            }
            if v > best {
                best = v;
                if v > alpha {
                    alpha = v;
                    if v >= beta {
                        return v;
                    }
                }
            }
        }
        if in_chk && legal == 0 {
            return -MATE + ply as i32;
        }
        best
    }

    fn has_np(&self, c: usize) -> bool {
        self.cnt[2 + (c << 3)] + self.cnt[3 + (c << 3)] + self.cnt[4 + (c << 3)] + self.cnt[5 + (c << 3)] > 0
    }

    fn negamax(&mut self, mut d: i32, mut alpha: i32, mut beta: i32, ply: usize, null_ok: bool) -> i32 {
        self.tick();
        if self.abort {
            return 0;
        }
        let pv = beta - alpha > 1;
        let us = self.stm;
        if ply > 0 {
            if self.hm >= 100 || self.is_rep() || self.insuff() {
                return 0;
            }
            alpha = alpha.max(-MATE + ply as i32);
            beta = beta.min(MATE - ply as i32 - 1);
            if alpha >= beta {
                return alpha;
            }
        }
        if ply >= MAXP - 2 {
            return self.evaluate();
        }
        let in_chk = self.attacked(self.ksq[us], us ^ 1);
        if in_chk && ply < 12 {
            d += 1;
        }
        if d <= 0 {
            return self.qs(alpha, beta, ply, 6);
        }
        let idx = (self.h1 & TT_MASK) as usize;
        let mut ttm = 0;
        let e = self.tt[idx];
        if e.k == self.h2 {
            ttm = e.mv;
            if !pv && ply > 0 && e.d as i32 >= d {
                let mut v = e.v as i32;
                if v > MATEB {
                    v -= ply as i32;
                } else if v < -MATEB {
                    v += ply as i32;
                }
                let f = e.f;
                if f == 0 || (f == 1 && v >= beta) || (f == 2 && v <= alpha) {
                    return v;
                }
            }
        }
        let se = if in_chk { -INF } else { self.evaluate() };
        if self.cfg[0] != 0 && !pv && !in_chk && d <= 3 && se - 110 * d >= beta && beta > -MATEB {
            return se - 110 * d;
        }
        if self.cfg[1] != 0 && !pv && !in_chk && null_ok && d >= 3 && se >= beta && self.has_np(us) && beta > -MATEB {
            self.make_null();
            let r = 2 + if d >= 6 { 1 } else { 0 } + if d >= 9 { 1 } else { 0 };
            let v = -self.negamax(d - 1 - r, -beta, -beta + 1, ply + 1, false);
            self.unmake_null();
            if self.abort {
                return 0;
            }
            if v >= beta {
                return if v > MATEB { beta } else { v };
            }
        }
        let n = self.gen(ply, false);
        self.score_moves(ply, n, ttm);
        let a0 = alpha;
        let mut best = -INF;
        let mut bm = 0;
        let mut legal = 0i32;
        for i in 0..n {
            let m = self.pick(ply, n, i);
            let f = (m & 63) as usize;
            let t = ((m >> 6) & 63) as usize;
            let fl = m >> 12;
            let cap = self.b[t];
            let quiet = (cap == 0 && fl < 2) || fl == 3 || fl == 4;
            self.make(m);
            if self.attacked(self.ksq[us], us ^ 1) {
                self.unmake();
                continue;
            }
            legal += 1;
            let chk = self.attacked(self.ksq[self.stm], self.stm ^ 1);
            if self.cfg[2] != 0 && !pv && !in_chk && !chk && quiet && legal > 1 && d <= 2 && se + 110 * d + 90 <= alpha && alpha > -MATEB {
                self.unmake();
                continue;
            }
            if self.cfg[3] != 0 && !pv && !in_chk && !chk && quiet && legal > 6 + d * d && d <= 4 && alpha > -MATEB {
                self.unmake();
                continue;
            }
            let v;
            let nd = d - 1;
            if legal == 1 {
                v = -self.negamax(nd, -beta, -alpha, ply + 1, true);
            } else {
                let mut red = 0;
                if self.cfg[4] != 0 && d >= 3 && quiet && legal > 2 && !in_chk && !chk {
                    red = self.lmr[d.min(63) as usize][legal.min(63) as usize] as i32;
                    if !pv {
                        red += 1;
                    }
                    if red > nd - 1 {
                        red = (nd - 1).max(0);
                    }
                }
                let mut vv = -self.negamax(nd - red, -alpha - 1, -alpha, ply + 1, true);
                if vv > alpha && red > 0 {
                    vv = -self.negamax(nd, -alpha - 1, -alpha, ply + 1, true);
                }
                if vv > alpha && vv < beta {
                    vv = -self.negamax(nd, -beta, -alpha, ply + 1, true);
                }
                v = vv;
            }
            self.unmake();
            if self.abort {
                return 0;
            }
            if v > best {
                best = v;
                bm = m;
                if ply == 0 {
                    self.root_best = m;
                    self.root_score = v;
                }
                if v > alpha {
                    alpha = v;
                    if v >= beta {
                        if quiet && fl < 5 {
                            let k = &mut self.kil[ply];
                            if k[0] != m {
                                k[1] = k[0];
                                k[0] = m;
                            }
                            let h = &mut self.hi[f * 64 + t];
                            *h = (*h + d * d).min(1_000_000);
                        }
                        break;
                    }
                }
            }
        }
        if legal == 0 {
            return if in_chk { -MATE + ply as i32 } else { 0 };
        }
        let fl2: i8 = if best <= a0 { 2 } else if best >= beta { 1 } else { 0 };
        let mut sv = best;
        if sv > MATEB {
            sv += ply as i32;
        } else if sv < -MATEB {
            sv -= ply as i32;
        }
        let e = &mut self.tt[idx];
        if e.k != self.h2 || e.d as i32 <= d {
            *e = TtE { k: self.h2, mv: bm, v: sv as i16, d: d as i8, f: fl2 };
        }
        best
    }

    fn legal_moves(&mut self, ply: usize, out: &mut Vec<i32>) {
        let n = self.gen(ply, false);
        let base = ply * STRIDE;
        let us = self.stm;
        for i in 0..n {
            let m = self.mv[base + i];
            self.make(m);
            let ok = !self.attacked(self.ksq[us], us ^ 1);
            self.unmake();
            if ok {
                out.push(m);
            }
        }
    }

    fn perft(&mut self, d: i32, ply: usize) -> u64 {
        if d == 0 {
            return 1;
        }
        let n = self.gen(ply, false);
        let base = ply * STRIDE;
        let us = self.stm;
        let mut c = 0;
        for i in 0..n {
            let m = self.mv[base + i];
            self.make(m);
            if !self.attacked(self.ksq[us], us ^ 1) {
                c += self.perft(d - 1, ply + 1);
            }
            self.unmake();
        }
        c
    }

    /// Returns false when the side to move has no legal move.
    fn search(&mut self, ms: f64, max_depth: i32, noise: f32, nhist: usize) -> bool {
        // history hashes (positions before the root that can still repeat)
        let mut hh: Vec<(u32, u32)> = Vec::with_capacity(nhist);
        for i in 0..nhist {
            self.set_pos(IN_HIST + i * POS_LEN);
            hh.push((self.h1, self.h2));
        }
        self.set_pos(0);
        let keep = self.sp;
        for (a, b) in hh {
            let sp = self.sp;
            self.u_h1[sp] = a;
            self.u_h2[sp] = b;
            self.u_mv[sp] = 0;
            self.sp += 1;
        }
        for e in self.tt.iter_mut() {
            *e = TtE::default();
        }
        for h in self.hi.iter_mut() {
            *h = 0;
        }
        for k in self.kil.iter_mut() {
            *k = [0, 0];
        }
        self.t0 = unsafe { now_ms() };
        self.tl = if ms > 0.0 { ms } else { 1000.0 };
        self.abort = false;
        self.nodes = 0;
        let max_d = (if max_depth > 0 { max_depth } else { 64 }).min(MAXP as i32 - 10);
        let mut rl: Vec<i32> = Vec::with_capacity(64);
        self.legal_moves(0, &mut rl);
        let io = unsafe { &mut IO };
        io[OUT_N] = rl.len() as i32;
        if rl.is_empty() {
            self.sp = keep;
            return false;
        }
        let ri = (self.rnd() * rl.len() as f32) as usize;
        let mut best = rl[ri.min(rl.len() - 1)];
        let mut bs: i32 = 0;
        let mut done = 0;
        if rl.len() == 1 && noise <= 0.0 {
            self.sp = keep;
            io[OUT_MOVE] = rl[0];
            io[OUT_CP] = 0;
            io[OUT_DEPTH] = 0;
            io[OUT_NODES] = 0;
            return true;
        }
        if noise > 0.0 {
            for d in 1..=max_d {
                // best move first
                if let Some(p) = rl.iter().position(|&x| x == best) {
                    let m = rl.remove(p);
                    rl.insert(0, m);
                }
                let mut bm = 0;
                let mut bv = -(INF as f32);
                let mut al = -INF;
                let list = rl.clone();
                for &m in &list {
                    self.make(m);
                    let r = -self.negamax(d - 1, -INF, -al, 1, true);
                    let v = r as f32 + self.rnd() * noise;
                    self.unmake();
                    if self.abort {
                        break;
                    }
                    if v > bv {
                        bv = v;
                        bm = m;
                    }
                    if v > al as f32 {
                        al = v as i32;
                    }
                }
                if self.abort {
                    break;
                }
                best = bm;
                bs = bv as i32;
                done = d;
                if bv > MATEB as f32 {
                    break;
                }
            }
        } else {
            let mut prev = 0;
            for d in 1..=max_d {
                let mut al = -INF;
                let mut be = INF;
                let mut w = 35;
                if d >= 5 {
                    al = prev - w;
                    be = prev + w;
                }
                self.root_best = 0;
                loop {
                    let v = self.negamax(d, al, be, 0, false);
                    if self.abort {
                        break;
                    }
                    if v <= al {
                        al = (-INF).max(al - w * 4);
                        w *= 4;
                        if v <= -MATEB {
                            al = -INF;
                        }
                    } else if v >= be {
                        be = INF.min(be + w * 4);
                        w *= 4;
                        if v >= MATEB {
                            be = INF;
                        }
                    } else {
                        prev = v;
                        break;
                    }
                }
                if self.root_best != 0 {
                    best = self.root_best;
                    bs = self.root_score;
                }
                if self.abort {
                    break;
                }
                done = d;
                if prev.abs() > MATEB && d >= max_d.min(12) {
                    break;
                }
                if unsafe { now_ms() } - self.t0 > self.tl * 0.55 {
                    break;
                }
            }
        }
        self.sp = keep;
        io[OUT_MOVE] = best;
        io[OUT_CP] = bs;
        io[OUT_DEPTH] = done;
        io[OUT_NODES] = self.nodes as i32;
        true
    }
}

// ---------------------------------------------------------------- exports
#[no_mangle]
pub extern "C" fn io_ptr() -> *mut i32 {
    unsafe { IO.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn init() {
    eng();
}

#[no_mangle]
pub extern "C" fn set_mode(m: i32) {
    eng().set_mode(m as u8);
}

/// i: 0 rfp, 1 nmp, 2 fut, 3 lmp, 4 lmr
#[no_mangle]
pub extern "C" fn set_cfg(i: i32, v: i32) {
    if (0..5).contains(&i) {
        eng().cfg[i as usize] = v;
    }
}

#[no_mangle]
pub extern "C" fn set_seed(lo: u32, hi: u32) {
    let s = ((hi as u64) << 32) | lo as u64;
    eng().rng = if s == 0 { 0x2545F4914F6CDD1D } else { s };
}

/// Reads the position at io[0..68] and (optionally) `nhist` earlier positions from io[72..].
/// Result in io[OUT_*]. Returns 0 when there is no legal move, else 1.
#[no_mangle]
pub extern "C" fn search(ms: f64, max_depth: i32, noise: f64, nhist: i32) -> i32 {
    let nh = (nhist.max(0) as usize).min((OUT_MOVE - IN_HIST) / POS_LEN);
    eng().search(ms, max_depth, noise as f32, nh) as i32
}

/// Legal moves of the position at io[0..68]; count returned, list at io[OUT_LIST..].
#[no_mangle]
pub extern "C" fn legal_moves() -> i32 {
    let e = eng();
    e.set_pos(0);
    let mut v = Vec::with_capacity(64);
    e.legal_moves(0, &mut v);
    let io = unsafe { &mut IO };
    let n = v.len().min(1000);
    for i in 0..n {
        io[OUT_LIST + i] = v[i];
    }
    n as i32
}

#[no_mangle]
pub extern "C" fn perft(depth: i32) -> f64 {
    let e = eng();
    e.set_pos(0);
    e.perft(depth, 0) as f64
}

#[no_mangle]
pub extern "C" fn eval() -> i32 {
    let e = eng();
    e.set_pos(0);
    e.evaluate()
}
