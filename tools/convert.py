import gzip, sys, json, numpy as np, net_pb2 as n
from policy_index import policy_index
import lc0_az_policy_map as pm

def dn(l):
    p=np.frombuffer(l.params,np.uint16).astype(np.float32)/65535.0
    return p*(l.max_val-l.min_val)+l.min_val

def fold(cb, o, i, k):
    W=dn(cb.weights).reshape(o,i,k,k)
    mean=dn(cb.bn_means); var=dn(cb.bn_stddivs); g=dn(cb.bn_gammas); b=dn(cb.bn_betas)
    s=g/np.sqrt(var+1e-5)
    return (W*s[:,None,None,None]).astype(np.float32), (b-mean*s).astype(np.float32)

def load(path):
    net=n.Net(); net.ParseFromString(gzip.open(path).read()); w=net.weights
    L=[]
    L+=list(fold(w.input,64,112,3))
    for r in w.residual:
        L+=list(fold(r.conv1,64,64,3)); L+=list(fold(r.conv2,64,64,3))
        L+=[dn(r.se.w1).reshape(8,64),dn(r.se.b1),dn(r.se.w2).reshape(128,8),dn(r.se.b2)]
    L+=list(fold(w.policy1,64,64,3))
    L+=[dn(w.policy.weights).reshape(80,64,3,3), dn(w.policy.biases)]
    return L

if __name__=='__main__':
    for lv in sys.argv[1:]:
        L=load(f'maia-{lv}.pb.gz')
        buf=np.concatenate([np.asarray(a,np.float32).ravel() for a in L]).astype(np.float16)
        buf.tofile(f'maia-{lv}.bin'); print(lv, buf.size, buf.nbytes)
    idx=np.array(pm.make_map('index'),dtype=np.int16); print(idx.shape, (idx>=0).sum())
    json.dump({'idx':idx.tolist(),'moves':policy_index},open('maia-map.json','w'),separators=(',',':'))
