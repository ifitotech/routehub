package com.routehub.driver;

import android.Manifest;
import android.content.Intent;
import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "DeviceAccess", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}),
    @Permission(alias = "camera", strings = {Manifest.permission.CAMERA})
})
public class DeviceAccessPlugin extends Plugin {
    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String url = call.getString("url", "");
        String fileName = call.getString("fileName", "RouteHub-Driver.apk");
        if (!url.startsWith("https://")) {
            call.reject("A secure update URL is required");
            return;
        }
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("RouteHub Driver update");
            request.setDescription("Downloading update. Tap the completed notification to install it.");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir("Download", fileName.replaceAll("[^A-Za-z0-9._-]", "_"));
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");
            long id = manager.enqueue(request);
            JSObject result = new JSObject();
            result.put("downloadId", String.valueOf(id));
            call.resolve(result);
        } catch (Exception error) { call.reject("Unable to download update", error); }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("location", getPermissionState("location").toString());
        result.put("camera", getPermissionState("camera").toString());
        result.put("versionCode", BuildConfig.VERSION_CODE);
        call.resolve(result);
    }

    @PluginMethod
    public void request(PluginCall call) {
        String permission = call.getString("permission", "");
        if (!permission.equals("location") && !permission.equals("camera")) {
            call.reject("Unsupported permission");
            return;
        }
        requestPermissionForAlias(permission, call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) { status(call); }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName())));
            call.resolve();
        } catch (Exception error) { call.reject("Unable to open Android settings", error); }
    }
}
