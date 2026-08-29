package com.devywork.bydconsole;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** A deliberately narrow shell for the HTTPS BYD terminal console. */
public final class ConsoleActivity extends Activity {
    static final String CONSOLE_URL = "https://byd.eduardotelaya.com/";
    private WebView webView;
    private View offlineView;
    private TextView offlineDetail;
    private boolean pageFinished;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable pageTimeout = () -> {
        if (!pageFinished) {
            showOffline("The secured gateway did not finish loading. Check the Internet and retry.");
        }
    };

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // Required by xterm.js in the gateway UI.
        settings.setDomStorageEnabled(false); // Do not persist the gateway token.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new ConsoleWebViewClient());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 15, 25));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        offlineView = buildOfflineView();
        root.addView(offlineView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        offlineView.setVisibility(View.GONE);
        setContentView(root);

        loadConsole();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(pageTimeout);
        webView.destroy();
        super.onDestroy();
    }

    private void loadConsole() {
        pageFinished = false;
        offlineView.setVisibility(View.GONE);
        mainHandler.removeCallbacks(pageTimeout);
        mainHandler.postDelayed(pageTimeout, 12000);
        webView.loadUrl(CONSOLE_URL);
    }

    private void showOffline(String detail) {
        mainHandler.removeCallbacks(pageTimeout);
        offlineDetail.setText(detail);
        offlineView.setVisibility(View.VISIBLE);
    }

    private View buildOfflineView() {
        float density = getResources().getDisplayMetrics().density;
        int padding = Math.round(28 * density);
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(padding, padding, padding, padding);
        panel.setBackgroundColor(Color.rgb(5, 15, 25));

        TextView title = new TextView(this);
        title.setText("BYD CONSOLE OFFLINE");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);

        offlineDetail = new TextView(this);
        offlineDetail.setText("Connect to the Internet, then retry the secured gateway.");
        offlineDetail.setTextColor(Color.rgb(180, 205, 225));
        offlineDetail.setTextSize(17);
        offlineDetail.setGravity(Gravity.CENTER);
        offlineDetail.setPadding(0, Math.round(18 * density), 0, Math.round(22 * density));

        Button retry = new Button(this);
        retry.setText("RETRY");
        retry.setOnClickListener((ignored) -> loadConsole());

        panel.addView(title, wrap());
        panel.addView(offlineDetail, wrap());
        panel.addView(retry, wrap());
        return panel;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private final class ConsoleWebViewClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            pageFinished = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageFinished = true;
            mainHandler.removeCallbacks(pageTimeout);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isConsoleUri(uri)) {
                return false;
            }
            return true; // Keep the shell confined to the gateway origin.
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    WebResourceError error) {
            if (request.isForMainFrame()) {
                showOffline("Could not load the secured gateway (network error "
                        + error.getErrorCode() + "). Retry after checking the connection.");
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            // A terminal gateway must never continue through an invalid certificate.
            handler.cancel();
            showOffline("Secure connection failed (TLS error " + error.getPrimaryError()
                    + "). The certificate was not bypassed.");
        }

        private boolean isConsoleUri(Uri uri) {
            return "https".equals(uri.getScheme())
                    && "byd.eduardotelaya.com".equalsIgnoreCase(uri.getHost());
        }
    }
}
