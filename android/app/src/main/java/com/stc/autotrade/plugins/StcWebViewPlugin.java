// android/app/src/main/java/com/stc/autotrade/plugins/StcWebViewPlugin.java

package com.stc.autotrade.plugins;

import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
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

    private Dialog     webViewDialog       = null;
    private WebView    registrationWebView = null;
    private PluginCall savedCall           = null;

    // State mirrors RegisterScreen.kt
    private boolean successAlreadyFired = false;
    private boolean hasClickedDaftar    = false;
    private boolean isWebFullyLoaded    = false;
    private boolean isReadyToClick      = false; // React kirim setelah 9s loading selesai

    // Data hasil extract
    private String capturedAuthToken = "";
    private String capturedDeviceId  = "";
    private String capturedEmail     = "";

    private static final List<String> SUCCESS_URL_PATTERNS = Arrays.asList(
            "/trading", "/onboarding", "/welcome", "/dashboard",
            "/home", "/account", "/main", "/member", "/profile",
            "/user", "/app", "/portal", "/logged"
    );

    private static final List<String> AUTH_COOKIE_NAMES = Arrays.asList(
            "authorization_token", "authorization-token",
            "auth_token", "authToken", "access_token", "accessToken", "token"
    );

    private static final List<String> DEVICE_COOKIE_NAMES = Arrays.asList(
            "device_id", "device-id", "deviceId"
    );

    // JS auto-click tombol Daftar — mirrors Kotlin navigator.loadUrl(JS) di RegisterScreen.kt
    private static final String JS_CLICK_DAFTAR =
            "javascript:(function() {" +
                    "  var buttons = document.querySelectorAll('button,a,input[type=button],input[type=submit]');" +
                    "  for (var i = 0; i < buttons.length; i++) {" +
                    "    var btn = buttons[i];" +
                    "    var text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();" +
                    "    if (text.indexOf('daftar') >= 0) {" +
                    "      try {" +
                    "        btn.scrollIntoView();" +
                    "        btn.focus();" +
                    "        btn.click();" +
                    "        console.log('DAFTAR_BUTTON_CLICKED');" +
                    "      } catch(e) { console.log('DAFTAR_CLICK_ERROR:' + e.message); }" +
                    "      break;" +
                    "    }" +
                    "  }" +
                    "})(); void(0);";

    // JS extract cookies dari halaman web
    private static final String JS_EXTRACT_COOKIES =
            "javascript:(function() {" +
                    "  try {" +
                    "    var data = {authtoken:'',deviceId:'',email:''};" +
                    "    var cookies = document.cookie.split(';');" +
                    "    for (var i=0;i<cookies.length;i++) {" +
                    "      var c = cookies[i].trim();" +
                    "      if (c.indexOf('authtoken=')===0)            data.authtoken = c.substring('authtoken='.length);" +
                    "      if (c.indexOf('authorization_token=')===0)  data.authtoken = c.substring('authorization_token='.length);" +
                    "      if (c.indexOf('access_token=')===0)         data.authtoken = c.substring('access_token='.length);" +
                    "      if (c.indexOf('device_id=')===0)            data.deviceId  = c.substring('device_id='.length);" +
                    "      if (c.indexOf('email=')===0)                data.email     = c.substring('email='.length);" +
                    "    }" +
                    "    console.log('REGDATA_COOKIES:' + JSON.stringify(data));" +
                    "  } catch(e) { console.log('REGDATA_COOKIES_ERROR:' + e.message); }" +
                    "})(); void(0);";

    // JS extract localStorage + sessionStorage
    private static final String JS_EXTRACT_STORAGE =
            "javascript:(function() {" +
                    "  try {" +
                    "    var d = {authtoken:'',deviceId:'',email:''};" +
                    "    d.authtoken = localStorage.getItem('authtoken')||localStorage.getItem('authorization_token')||localStorage.getItem('access_token')||'';" +
                    "    d.deviceId  = localStorage.getItem('device_id')||'';" +
                    "    d.email     = localStorage.getItem('email')||localStorage.getItem('user_email')||'';" +
                    "    console.log('REGDATA_STORAGE:' + JSON.stringify(d));" +
                    "  } catch(e) { console.log('REGDATA_STORAGE_ERROR:'+e.message); }" +
                    "  try {" +
                    "    var s = {authtoken:'',deviceId:'',email:''};" +
                    "    s.authtoken = sessionStorage.getItem('authtoken')||sessionStorage.getItem('authorization_token')||'';" +
                    "    s.deviceId  = sessionStorage.getItem('device_id')||'';" +
                    "    s.email     = sessionStorage.getItem('email')||'';" +
                    "    console.log('REGDATA_SESSION:' + JSON.stringify(s));" +
                    "  } catch(e) { console.log('REGDATA_SESSION_ERROR:'+e.message); }" +
                    "})(); void(0);";

    // ─────────────────────────────────────────────────────────────────────────
    // open — buka WebView dialog, mulai load registration URL di background
    // Dipanggil React saat page pertama kali mount (bersamaan dengan loading overlay)
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("URL is required"); return; }

        savedCall           = call;
        successAlreadyFired = false;
        hasClickedDaftar    = false;
        isWebFullyLoaded    = false;
        isReadyToClick      = false;
        capturedAuthToken   = "";
        capturedDeviceId    = "";
        capturedEmail       = "";
        call.setKeepAlive(true);

        String finalUrl = url;
        getActivity().runOnUiThread(() -> buildAndShowDialog(finalUrl));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // notifyReady — React panggil ini setelah loading 9s selesai (100%)
    // Mirrors: LaunchedEffect(isProgressComplete, isWebFullyLoaded, !hasClickedDaftar)
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void notifyReady(PluginCall call) {
        isReadyToClick = true;
        call.resolve();
        // Kalau WebView sudah selesai load → langsung auto-click
        if (isWebFullyLoaded && !hasClickedDaftar) {
            getActivity().runOnUiThread(this::tryAutoClickDaftar);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // close
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(this::dismissDialog);
        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // buildAndShowDialog — buat Dialog dengan WebView fullscreen
    // ─────────────────────────────────────────────────────────────────────────
    private void buildAndShowDialog(String url) {
        Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        dialog.setCancelable(true);

        FrameLayout root = new FrameLayout(getActivity());
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setBackgroundColor(Color.WHITE);

        // WebView
        WebView webView = new WebView(getActivity());
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/138.0.0.0 Safari/537.36");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // ── WebViewClient — URL monitoring ─────────────────────────────────
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                if (req != null && req.getUrl() != null)
                    onUrlChanged(req.getUrl().toString());
                return false;
            }
            @Override
            public void onPageStarted(WebView v, String pageUrl, Bitmap fav) {
                super.onPageStarted(v, pageUrl, fav);
                if (pageUrl != null) onUrlChanged(pageUrl);
            }
            @Override
            public void onPageFinished(WebView v, String pageUrl) {
                super.onPageFinished(v, pageUrl);
                if (pageUrl != null) onUrlChanged(pageUrl);
                isWebFullyLoaded = true;
                // Kalau React sudah notify (9s selesai) → auto-click
                if (isReadyToClick && !hasClickedDaftar)
                    getActivity().runOnUiThread(() -> tryAutoClickDaftar());
            }
        });

        // ── WebChromeClient — tangkap console.log ──────────────────────────
        // Mirrors: Kotlin ConsoleMessage handler
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {
                String text = msg.message();
                if (text == null) return false;

                // Daftar button berhasil diklik
                if (text.contains("DAFTAR_BUTTON_CLICKED")) {
                    hasClickedDaftar = true;
                    JSObject ev = new JSObject();
                    ev.put("clicked", true);
                    notifyListeners("daftarClicked", ev);
                }

                // Data token/deviceId dari JS extraction
                if (text.startsWith("REGDATA_COOKIES:") ||
                        text.startsWith("REGDATA_STORAGE:") ||
                        text.startsWith("REGDATA_SESSION:")) {
                    parseRegData(text);
                }

                return false;
            }
        });

        // ── Overlay "Memuat..." di dalam dialog ────────────────────────────
        // Muncul sampai tombol Daftar berhasil di-klik
        LinearLayout loadingView = new LinearLayout(getActivity());
        loadingView.setOrientation(LinearLayout.VERTICAL);
        loadingView.setBackgroundColor(Color.WHITE);
        loadingView.setGravity(android.view.Gravity.CENTER);
        loadingView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ProgressBar spinner = new ProgressBar(getActivity());
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(80, 80);
        spinner.setLayoutParams(spinnerParams);

        TextView loadingText = new TextView(getActivity());
        loadingText.setText("Membuka halaman pendaftaran...");
        loadingText.setTextColor(Color.parseColor("#5F6368"));
        loadingText.setTextSize(14f);
        loadingText.setPadding(0, 24, 0, 0);
        loadingText.setGravity(android.view.Gravity.CENTER);

        loadingView.addView(spinner);
        loadingView.addView(loadingText);

        root.addView(webView);
        root.addView(loadingView);

        // Sembunyikan loadingView setelah Daftar diklik
        startOverlayWatcher(loadingView, loadingText);

        dialog.setContentView(root);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                dialog.getWindow().setStatusBarColor(Color.parseColor("#F2F2F7"));
            }
        }

        dialog.setOnDismissListener(d -> {
            webViewDialog       = null;
            registrationWebView = null;
            if (!successAlreadyFired) {
                JSObject ev = new JSObject();
                ev.put("finished",  true);
                ev.put("cancelled", true);
                notifyListeners("browserFinished", ev);
            }
        });

        dialog.show();
        webViewDialog       = dialog;
        registrationWebView = webView;

        webView.loadUrl(url);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // startOverlayWatcher
    // Polling 200ms, sembunyikan overlay setelah hasClickedDaftar = true
    // Mirrors: LaunchedEffect(hasClickedDaftar) { delay(500); showLoading = false }
    // ─────────────────────────────────────────────────────────────────────────
    private void startOverlayWatcher(View overlay, TextView loadingText) {
        Handler h = new Handler(Looper.getMainLooper());
        h.post(new Runnable() {
            @Override public void run() {
                if (hasClickedDaftar) {
                    // Delay 500ms sebelum hilang — sama dengan Kotlin
                    h.postDelayed(() -> overlay.setVisibility(View.GONE), 500);
                } else if (isReadyToClick) {
                    loadingText.setText("Mencari tombol daftar...");
                    h.postDelayed(this, 200);
                } else {
                    h.postDelayed(this, 200);
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // tryAutoClickDaftar
    // Mirrors: navigator.loadUrl(JS_CLICK_DAFTAR) di RegisterScreen.kt
    // ─────────────────────────────────────────────────────────────────────────
    private void tryAutoClickDaftar() {
        if (registrationWebView == null || hasClickedDaftar) return;
        registrationWebView.loadUrl(JS_CLICK_DAFTAR);

        // Retry setelah 3s jika belum berhasil — mirrors Kotlin repeat(30) loop
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!hasClickedDaftar && registrationWebView != null)
                registrationWebView.loadUrl(JS_CLICK_DAFTAR);
        }, 3000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // onUrlChanged
    // Mirrors: LaunchedEffect(currentDetectedUrl) + isSuccessUrl()
    // ─────────────────────────────────────────────────────────────────────────
    private void onUrlChanged(String url) {
        if (successAlreadyFired) return;
        String lower = url.toLowerCase();
        boolean isSuccess = false;
        for (String p : SUCCESS_URL_PATTERNS) {
            if (lower.contains(p)) { isSuccess = true; break; }
        }
        if (!isSuccess) return;

        successAlreadyFired = true;

        // Extract dari CookieManager native
        CookieManager cm = CookieManager.getInstance();
        String c1 = cm.getCookie("https://stockity.id");
        String c2 = cm.getCookie("https://trade.stockity.id");
        String allCookies = (c1 != null ? c1 : "") + "; " + (c2 != null ? c2 : "");

        String tokenFromCookie  = extractCookieValue(allCookies, AUTH_COOKIE_NAMES);
        String deviceFromCookie = extractCookieValue(allCookies, DEVICE_COOKIE_NAMES);
        if (tokenFromCookie  != null && !tokenFromCookie.isEmpty())  capturedAuthToken = tokenFromCookie;
        if (deviceFromCookie != null && !deviceFromCookie.isEmpty()) capturedDeviceId  = deviceFromCookie;

        // Jalankan JS extraction
        if (registrationWebView != null) {
            getActivity().runOnUiThread(() -> {
                registrationWebView.loadUrl(JS_EXTRACT_COOKIES);
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (registrationWebView != null)
                        registrationWebView.loadUrl(JS_EXTRACT_STORAGE);
                }, 500);
                // Resolve ke React setelah semua extraction selesai
                new Handler(Looper.getMainLooper()).postDelayed(
                        () -> resolveWithData(url), 1500);
            });
        } else {
            resolveWithData(url);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // parseRegData — parse REGDATA_* dari console.log
    // ─────────────────────────────────────────────────────────────────────────
    private void parseRegData(String logText) {
        try {
            int start = logText.indexOf('{');
            if (start < 0) return;
            String json      = logText.substring(start);
            String authToken = extractJsonValue(json, "authtoken");
            String deviceId  = extractJsonValue(json, "deviceId");
            String email     = extractJsonValue(json, "email");

            if (authToken != null && !authToken.isEmpty()) capturedAuthToken = authToken;
            if (deviceId  != null && !deviceId.isEmpty())  capturedDeviceId  = deviceId;
            if (email     != null && !email.isEmpty())      capturedEmail     = email;
        } catch (Exception ignored) {}
    }

    private String extractJsonValue(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return null;
        start += search.length();
        int end = json.indexOf("\"", start);
        if (end < 0) return null;
        return json.substring(start, end);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // resolveWithData — kirim result ke React dan tutup dialog
    // ─────────────────────────────────────────────────────────────────────────
    private void resolveWithData(String url) {
        JSObject result = new JSObject();
        result.put("url",       url);
        result.put("authToken", capturedAuthToken);
        result.put("deviceId",  capturedDeviceId);
        result.put("email",     capturedEmail);
        result.put("success",   !capturedAuthToken.isEmpty());

        if (savedCall != null) savedCall.resolve(result);

        new Handler(Looper.getMainLooper()).postDelayed(this::dismissDialog, 300);
    }

    private void dismissDialog() {
        if (webViewDialog != null) {
            try { webViewDialog.dismiss(); } catch (Exception ignored) {}
        }
        webViewDialog       = null;
        registrationWebView = null;
    }

    private String extractCookieValue(String cookieString, List<String> names) {
        if (cookieString == null || cookieString.isEmpty()) return null;
        for (String name : names) {
            for (String pair : cookieString.split(";")) {
                String t = pair.trim();
                if (t.toLowerCase().startsWith(name.toLowerCase() + "=")) {
                    String v = t.substring(name.length() + 1).trim();
                    if (!v.isEmpty()) return v;
                }
            }
        }
        return null;
    }

    @Override
    protected void handleOnDestroy() {
        dismissDialog();
        super.handleOnDestroy();
    }
}