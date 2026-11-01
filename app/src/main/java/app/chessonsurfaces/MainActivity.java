package app.chessonsurfaces;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/** Hosts the game (assets/www) in a WebView served from a private https origin. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView wv;
    private SharedPreferences sp;
    private boolean menuOpen, fullscreen, keepAwake = true;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        sp = getSharedPreferences("cos", MODE_PRIVATE);
        keepAwake = sp.getBoolean("keep", true);
        int bg = sp.getInt("bg", 0xFF17181A);
        getWindow().setBackgroundDrawable(new ColorDrawable(bg));
        wv = new WebView(this);
        wv.setBackgroundColor(bg);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(wv);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        wv.addJavascriptInterface(new Bridge(), "NativeApp");
        wv.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serve(r.getUrl().getHost(), r.getUrl().getPath());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return true; }
        });
        applyKeepAwake();
        if (b != null) wv.restoreState(b); else wv.loadUrl("https://" + HOST + "/www/index.html");
    }

    private WebResourceResponse serve(String host, String path) {
        if (!HOST.equals(host) || path == null || !path.startsWith("/www/"))
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, new ByteArrayInputStream(new byte[0]));
        try {
            InputStream in = getAssets().open(path.substring(1));
            String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css"
                : path.endsWith(".js") ? "application/javascript" : path.endsWith(".wasm") ? "application/wasm" : path.endsWith(".woff2") ? "font/woff2"
                : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "application/octet-stream";
            return new WebResourceResponse(mime, "UTF-8", in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, new ByteArrayInputStream(new byte[0]));
        }
    }

    private void applyKeepAwake() {
        Window w = getWindow();
        if (keepAwake) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (wv != null) wv.setKeepScreenOn(keepAwake);
    }

    private void applyImmersive() {
        int f = fullscreen ? (View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE) : View.SYSTEM_UI_FLAG_VISIBLE;
        if (!fullscreen) {
            if (sp.getBoolean("darkIcons", false)) {
                f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (android.os.Build.VERSION.SDK_INT >= 26) f |= 0x10; // LIGHT_NAVIGATION_BAR
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(f);
    }

    @Override protected void onResume() { super.onResume(); wv.onResume(); applyKeepAwake(); applyImmersive(); }
    @Override protected void onPause() { wv.onPause(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); wv.saveState(o); }
    @Override public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        wv.evaluateJavascript("window.__sysMode&&__sysMode()", null);
    }
    @Override protected void onDestroy() { wv.destroy(); super.onDestroy(); }

    @Override public void onBackPressed() {
        wv.evaluateJavascript("window.__back?__back():false", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); }
        });
    }

    private class Bridge {
        @JavascriptInterface public boolean systemDark() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        }
        @JavascriptInterface public void setBars(final String hex, final boolean dark) {
            runOnUiThread(new Runnable() { public void run() {
                int c;
                try { c = Color.parseColor(hex); } catch (Exception e) { return; }
                getWindow().setStatusBarColor(c);
                getWindow().setNavigationBarColor(c);
                getWindow().setBackgroundDrawable(new ColorDrawable(c));
                wv.setBackgroundColor(c);
                sp.edit().putInt("bg", c).putBoolean("darkIcons", !dark).apply();
                applyImmersive();
            }});
        }
        @JavascriptInterface public void vibrate(String json) {
            try {
                String[] p = json.replace("[", "").replace("]", "").split(",");
                long[] pat = new long[p.length + 1];
                for (int i = 0; i < p.length; i++) pat[i + 1] = Long.parseLong(p[i].trim());
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) v.vibrate(pat, -1);
            } catch (Exception ignored) {}
        }
        @JavascriptInterface public void keepAwake(final boolean on) {
            keepAwake = on; sp.edit().putBoolean("keep", on).apply();
            runOnUiThread(new Runnable() { public void run() { applyKeepAwake(); }});
        }
        @JavascriptInterface public void setFullscreen(final boolean on) {
            fullscreen = on;
            runOnUiThread(new Runnable() { public void run() { applyImmersive(); }});
        }
        @JavascriptInterface public void copy(final String t) {
            runOnUiThread(new Runnable() { public void run() {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("chess", t));
            }});
        }
        @JavascriptInterface public void menuState(boolean open) { menuOpen = open; }
    }
}
