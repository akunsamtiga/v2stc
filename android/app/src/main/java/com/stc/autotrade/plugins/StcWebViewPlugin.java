// Lokasi file: android/app/src/main/java/com/stc/autotrade/plugins/StcWebViewPlugin.java
//
// Buat folder 'plugins' di dalam:
//   android/app/src/main/java/com/stc/autotrade/
// lalu taruh file ini di sana.

package com.stc.autotrade.plugins;

import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(name = "StcWebView")
public class StcWebViewPlugin extends Plugin {

    private Dialog webViewDialog = null;
    private PluginCall savedCall = null;
    private boolean successAlreadyFired = false;

    // Mirrors SUCCESS_URL_PATTERNS dari RegisterScreen.kt
    private static final List<String> SUCCESS_URL_PATTERNS = Arrays.asList(
            "/trading", "/onboarding", "/welcome", "/dashboard",
            "/home", "/account", "/main", "/member", "/profile",
            "/user", "/app", "/portal", "/logged"
    );

    private static final List<String> AUTH_COOKIE_NAMES = Arrays.asList(
            "authorization_token", "authorization-token",
            "auth_token", "authToken",
            "access_token", "accessToken",
            "token"
    );

    private static final List<String> DEVICE_COOKIE_NAMES = Arrays.asList(
            "device_id", "device-id", "deviceId"
    );

    // ─── open ─────────────────────────────────────────────────────────────────
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        savedCall            = call;
        successAlreadyFired  = false;
        call.setKeepAlive(true);

        String finalUrl = url;
        getActivity().runOnUiThread(() -> showWebViewDialog(finalUrl));
    }

    // ─── close ────────────────────────────────────────────────────────────────
    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webViewDialog != null) {
                webViewDialog.dismiss();
                webViewDialog = null;
            }
        });
        call.resolve();
    }

    // ─── showWebViewDialog ────────────────────────────────────────────────────
    private void showWebViewDialog(String url) {
        Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        dialog.setCancelable(true);

        // Root layout
        LinearLayout root = new LinearLayout(getActivity());
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.setBackgroundColor(Color.WHITE);

        // Toolbar
        LinearLayout toolbar = new LinearLayout(getActivity());
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams toolbarParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 120
        );
        toolbar.setLayoutParams(toolbarParams);
        toolbar.setPadding(24, 0, 24, 0);
        toolbar.setBackgroundColor(Color.parseColor("#F8F9FA"));

        TextView titleText = new TextView(getActivity());
        titleText.setText("Daftar Akun");
        titleText.setTextSize(16f);
        titleText.setTextColor(Color.parseColor("#202124"));
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        );
        titleParams.gravity = android.view.Gravity.CENTER_VERTICAL;
        titleText.setLayoutParams(titleParams);

        ImageButton closeBtn = new ImageButton(getActivity());
        closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setOnClickListener(v -> dialog.dismiss());

        toolbar.addView(titleText);
        toolbar.addView(closeBtn);

        // Progress bar
        ProgressBar progressBar = new ProgressBar(
                getActivity(), null, android.R.attr.progressBarStyleHorizontal
        );
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 8
        ));
        progressBar.setMax(100);

        // WebView
        WebView webView = new WebView(getActivity());
        webView.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // Mirror User-Agent dari UserProfileApiService.kt
        settings.setUserAgentString(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/138.0.0.0 Safari/537.36"
        );

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // WebViewClient — mirrors UrlDetectorWebViewClient dari RegisterScreen.kt
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    checkForSuccess(request.getUrl().toString(), dialog);
                }
                return false; // biarkan WebView load URL
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                super.onPageFinished(view, pageUrl);
                if (pageUrl != null) checkForSuccess(pageUrl, dialog);
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onPageStarted(WebView view, String pageUrl, Bitmap favicon) {
                super.onPageStarted(view, pageUrl, favicon);
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(30);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) progressBar.setVisibility(View.GONE);
            }
        });

        root.addView(toolbar);
        root.addView(progressBar);
        root.addView(webView);

        dialog.setContentView(root);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            );
            dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                dialog.getWindow().setStatusBarColor(Color.parseColor("#F8F9FA"));
            }
        }

        // User tutup manual tanpa registrasi selesai
        dialog.setOnDismissListener(d -> {
            webViewDialog = null;
            if (!successAlreadyFired) {
                JSObject data = new JSObject();
                data.put("finished",  true);
                data.put("cancelled", true);
                notifyListeners("browserFinished", data);
            }
        });

        dialog.show();
        webViewDialog = dialog;
        webView.loadUrl(url);
    }

    // ─── checkForSuccess ──────────────────────────────────────────────────────
    // Mirrors: isSuccessUrl() + CookieManager.getCookie() dari RegisterScreen.kt
    private void checkForSuccess(String url, Dialog dialog) {
        if (successAlreadyFired) return;

        String urlLower = url.toLowerCase();
        boolean isSuccess = false;
        for (String pattern : SUCCESS_URL_PATTERNS) {
            if (urlLower.contains(pattern)) { isSuccess = true; break; }
        }
        if (!isSuccess) return;

        successAlreadyFired = true;

        CookieManager cm = CookieManager.getInstance();
        String stockityCookies = cm.getCookie("https://stockity.id");
        String tradingCookies  = cm.getCookie("https://trade.stockity.id");
        String allCookies = "";
        if (stockityCookies != null) allCookies += stockityCookies;
        if (tradingCookies  != null) allCookies += "; " + tradingCookies;

        String authToken = extractCookieValue(allCookies, AUTH_COOKIE_NAMES);
        String deviceId  = extractCookieValue(allCookies, DEVICE_COOKIE_NAMES);
        if (authToken == null) authToken = "";
        if (deviceId  == null) deviceId  = "";

        JSObject result = new JSObject();
        result.put("url",       url);
        result.put("authToken", authToken);
        result.put("deviceId",  deviceId);
        result.put("success",   true);

        if (savedCall != null) savedCall.resolve(result);

        // Dismiss setelah 500ms agar user tidak kaget
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (dialog.isShowing()) dialog.dismiss();
        }, 500);
    }

    // ─── extractCookieValue ───────────────────────────────────────────────────
    private String extractCookieValue(String cookieString, List<String> names) {
        if (cookieString == null || cookieString.isEmpty()) return null;
        String[] pairs = cookieString.split(";");
        for (String name : names) {
            for (String pair : pairs) {
                String trimmed = pair.trim();
                if (trimmed.toLowerCase().startsWith(name.toLowerCase() + "=")) {
                    String value = trimmed.substring(name.length() + 1).trim();
                    if (!value.isEmpty()) return value;
                }
            }
        }
        return null;
    }

    @Override
    protected void handleOnDestroy() {
        if (webViewDialog != null) {
            webViewDialog.dismiss();
            webViewDialog = null;
        }
        super.handleOnDestroy();
    }
}