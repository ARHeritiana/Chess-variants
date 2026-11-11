package app.chessonsurfaces;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shared validation for custom manifests and public GitHub release metadata. */
final class UpdateManifest {
    static JSONObject parse(String json, String packageName) throws Exception {
        JSONObject manifest = new JSONObject(json);
        if (manifest.has("assets")) {
            if (manifest.optBoolean("draft") || manifest.optBoolean("prerelease")) throw new Exception("not a stable release");
            JSONArray assets = manifest.getJSONArray("assets");
            JSONObject release = manifest; manifest = null;
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.getJSONObject(i);
                Matcher match = Pattern.compile("ChessVariants-([0-9]+)\\.apk").matcher(asset.optString("name"));
                if (!match.matches()) continue;
                long code = Long.parseLong(match.group(1));
                if (manifest == null || code > manifest.getLong("version_code"))
                    manifest = new JSONObject().put("package_name", packageName)
                        .put("version_code", code).put("version_name", release.getString("tag_name"))
                        .put("url", asset.getString("browser_download_url"));
            }
            if (manifest == null) throw new Exception("no versioned APK asset");
        }
        URI url = new URI(manifest.getString("url"));
        long code = manifest.getLong("version_code");
        if (!packageName.equals(manifest.getString("package_name")) ||
            !"https".equals(url.getScheme()) || url.getHost() == null || url.getUserInfo() != null ||
            manifest.getString("version_name").trim().isEmpty() || manifest.getString("version_name").length() > 80 ||
            code < 1 || code > Integer.MAX_VALUE || !String.valueOf(manifest.get("version_code")).matches("[1-9][0-9]*")) throw new Exception("invalid manifest");
        return manifest;
    }
}
