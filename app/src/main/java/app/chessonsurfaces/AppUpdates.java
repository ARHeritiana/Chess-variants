package app.chessonsurfaces;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Handler;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

/** Public HTTPS manifest; never embed repository credentials in the APK. */
final class AppUpdates {
    private final Activity activity;
    private final WebView web;
    private final Handler handler = new Handler();
    private boolean ready, active, checking, registered, destroyed, manualRequested;
    private long lastCheck;
    private JSONObject latest;
    private String downloadUrl;
    private static final long INTERVAL = 15 * 60 * 1000L;
    private final Runnable poll = new Runnable() { public void run() {
        check(false); if (active) handler.postDelayed(this, INTERVAL);
    }};
    private final BroadcastReceiver connectivity = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { check(false); }
    };
    AppUpdates(Activity activity, WebView web) { this.activity = activity; this.web = web; }
    void ready() { ready = true; if (latest != null) emit("__updateAvailable", latest); check(false); }
    void resume() {
        active = true;
        if (!registered) {
            activity.registerReceiver(connectivity, new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION));
            registered = true;
        }
        handler.removeCallbacks(poll); poll.run();
    }
    void pause() {
        active = false; handler.removeCallbacks(poll);
        if (registered) { activity.unregisterReceiver(connectivity); registered = false; }
    }
    void destroy() { destroyed = true; pause(); handler.removeCallbacksAndMessages(null); }
    private void emit(String fn, Object value) {
        if (destroyed || !ready) return;
        String json = value instanceof JSONObject ? value.toString() : JSONObject.quote(String.valueOf(value));
        web.evaluateJavascript("window." + fn + "&&window." + fn + "(" + json + ")", null);
    }
    void check(final boolean manual) {
        if (!ready || destroyed) return;
        if (checking) { manualRequested |= manual; return; }
        ConnectivityManager cm = (ConnectivityManager) activity.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo network = cm == null ? null : cm.getActiveNetworkInfo();
        if (network == null || !network.isConnected()) {
            if (manual) emit("__updateStatus", "You are offline. Updates will be checked when you reconnect.");
            return;
        }
        if (!manual && System.currentTimeMillis() - lastCheck < INTERVAL) return;
        final String feed = activity.getString(R.string.update_feed_url);
        if (!feed.startsWith("https://")) {
            if (manual) emit("__updateStatus", "No update feed is configured for this build.");
            return;
        }
        checking = true;
        new Thread(new Runnable() { public void run() {
            JSONObject found = null; String message; boolean success = false;
            HttpsURLConnection connection = null;
            try {
                connection = (HttpsURLConnection) new URL(feed).openConnection();
                connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "ChessVariants-Android");
                connection.setUseCaches(false);
                int response = connection.getResponseCode();
                if (response == 404 && feed.equals("https://api.github.com/repos/ARHeritiana/Chess-variants/releases/latest")) {
                    success = true; message = "No published updates yet.";
                } else {
                    if (response != 200) throw new Exception("feed unavailable");
                    ByteArrayOutputStream data = new ByteArrayOutputStream();
                    try (InputStream input = connection.getInputStream()) {
                        byte[] buffer = new byte[4096]; int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (data.size() + count > 65536) throw new Exception("manifest too large");
                            data.write(buffer, 0, count);
                        }
                    }
                    JSONObject manifest = UpdateManifest.parse(data.toString("UTF-8"), activity.getPackageName());
                    long installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
                    if (manifest.getLong("version_code") > installed) found = manifest;
                    success = true;
                    message = found == null ? "You have the latest version." : "Update available.";
                }
            } catch (Exception e) {
                message = "Could not check for updates. Check your connection and try again.";
            } finally { if (connection != null) connection.disconnect(); }
            final JSONObject result = found; final String status = message; final boolean ok = success;
            activity.runOnUiThread(new Runnable() { public void run() {
                checking = false; if (destroyed) return;
                boolean report = manual || manualRequested; manualRequested = false;
                if (ok) lastCheck = System.currentTimeMillis();
                if (result != null) {
                    boolean changed = latest == null || latest.optLong("version_code") != result.optLong("version_code");
                    latest = result; downloadUrl = result.optString("url");
                    if (report || changed) emit("__updateAvailable", result);
                } else if (ok) { latest = null; downloadUrl = null; emit("__updateCurrent", status); }
                if (report) emit("__updateStatus", status);
            }});
        }}, "app-update-check").start();
    }
    void open() {
        if (downloadUrl == null) return;
        try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))); }
        catch (Exception e) { emit("__updateStatus", "No browser is available to download the update."); }
    }
}
