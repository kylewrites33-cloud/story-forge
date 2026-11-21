// Sparrow Pocket's Android app (Kyle, 2026-11-21: "just make the app file"; then "Can we ditch address strip").
// One full-screen window showing the live Pocket page, with no address bar. It is only a window: everything Pocket
// does is the web page, so the app never needs a new file when Pocket changes. It keeps its own saved key (apart from
// Chrome's); Pocket in Chrome hands it over once with sparrowpocket://open?key=..., which this app turns into Pocket's
// own key address (the part after #, which never goes to a server).
package io.github.kylewrites33cloud.pocket;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    static final String HOST = "kylewrites33-cloud.github.io";
    static final String HOME = "https://" + HOST + "/story-forge/pocket/";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " SparrowPocketApp/1");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                // Pocket and Sparrow stay in the window; anything else opens in Chrome.
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/story-forge/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nothing can open it */ }
                return true;
            }
        });
        setContentView(web);
        if (saved != null && web.restoreState(saved) != null) return;
        web.loadUrl(addressFor(getIntent()));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String a = addressFor(intent);
        if (!a.equals(HOME)) web.loadUrl(a);
    }

    /** Pocket's address for how the app was opened: its first page, or its key address when Chrome handed a key over. */
    static String addressFor(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u != null && "sparrowpocket".equals(u.getScheme())) {
            String q = u.getEncodedQuery();
            if (q != null && q.contains("key=")) return HOME + "#" + q;
        }
        if (u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost())) return u.toString();
        return HOME;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
