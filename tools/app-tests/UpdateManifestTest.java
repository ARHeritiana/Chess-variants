package app.chessonsurfaces;
import org.json.JSONObject;

public final class UpdateManifestTest {
    private static final String PACKAGE = "app.chessonsurfaces";
    private static final String VALID = "{\"package_name\":\"app.chessonsurfaces\",\"version_code\":4,\"version_name\":\"2.1\",\"url\":\"https://example.com/app.apk\"}";
    private static void reject(String text) throws Exception {
        try { UpdateManifest.parse(text, PACKAGE); throw new AssertionError("accepted invalid manifest: " + text); }
        catch (AssertionError e) { throw e; } catch (Exception expected) { }
    }
    public static void main(String[] args) throws Exception {
        if (UpdateManifest.parse(VALID, PACKAGE).getLong("version_code") != 4) throw new AssertionError();
        reject("not json");
        reject(VALID.replace("app.chessonsurfaces", "other.app"));
        reject(VALID.replace("https://example.com/app.apk", "javascript:alert(1)"));
        reject(VALID.replace("https://example.com/app.apk", "http://example.com/app.apk"));
        reject(VALID.replace("https://example.com/app.apk", "https://user@example.com/app.apk"));
        reject(VALID.replace(":4,", ":0,"));
        reject(VALID.replace(":4,", ":4.5,"));
        reject(VALID.replace(":4,", ":2147483648,"));
        reject(VALID.replace("\"2.1\"", "\"\""));
        reject("{\"tag_name\":\"v2.1\",\"assets\":[]}");
        String release = "{\"tag_name\":\"v2.1\",\"assets\":[{\"name\":\"ChessVariants-3.apk\",\"browser_download_url\":\"https://example.com/3.apk\"},{\"name\":\"ChessVariants-4.apk\",\"browser_download_url\":\"https://example.com/4.apk\"},{\"name\":\"unrelated-99.apk\"}]}";
        JSONObject parsed = UpdateManifest.parse(release, PACKAGE);
        if (parsed.getLong("version_code") != 4 || !parsed.getString("url").endsWith("4.apk")) throw new AssertionError();
        reject(release.replace("\"tag_name\"", "\"draft\":true,\"tag_name\""));
        reject(release.replace("\"tag_name\"", "\"prerelease\":true,\"tag_name\""));
        System.out.println("PASS: update manifests, versioned release APK selection, invalid packages/versions/URLs and draft/prerelease rejection.");
    }
}
