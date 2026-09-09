package com.routehub.driver;

import android.Manifest;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
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
    private long pendingUpdateDownloadId = -1L;
    private BroadcastReceiver updateDownloadReceiver;

    @PluginMethod
    public void startLocationTracking(PluginCall call) {
        String url = call.getString("supabaseUrl", "");
        String key = call.getString("supabaseAnonKey", "");
        String accessToken = call.getString("accessToken", "");
        String refreshToken = call.getString("refreshToken", "");
        String sessionId = call.getString("sessionId", "");
        String driverId = call.getString("driverId", "");
        if (!url.startsWith("https://") || key.isEmpty() || accessToken.isEmpty() || refreshToken.isEmpty() || sessionId.isEmpty() || driverId.isEmpty()) {
            call.reject("A secure signed-in location session is required");
            return;
        }
        if (getPermissionState("location") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Allow precise location before starting Driving Day");
            return;
        }
        Intent intent = new Intent(getContext(), DriverLocationService.class);
        intent.setAction(DriverLocationService.ACTION_START);
        intent.putExtra("supabaseUrl", url);
        intent.putExtra("supabaseAnonKey", key);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("refreshToken", refreshToken);
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("driverId", driverId);
        intent.putExtra("intervalMinutes", call.getInt("intervalMinutes", 20));
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        } catch (Exception error) { call.reject("Unable to start location sharing", error); }
    }

    @PluginMethod
    public void stopLocationTracking(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), DriverLocationService.class);
            intent.setAction(DriverLocationService.ACTION_STOP);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) { call.reject("Unable to stop location sharing", error); }
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String url = call.getString("url", "");
        String fileName = call.getString("fileName", "RouteHub-Driver.apk");
        if (!url.startsWith("https://")) {
            call.reject("A secure update URL is required");
            return;
        }
        try {
            // Android requires a one-time, user-controlled approval before an app
            // installed outside Play can hand an APK to the package installer.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
                JSObject result = new JSObject();
                result.put("requiresInstallPermission", true);
                call.resolve(result);
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("RouteHub Driver update");
            request.setDescription("Downloading update. The installer will open when it is ready.");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir("Download", fileName.replaceAll("[^A-Za-z0-9._-]", "_"));
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");
            long id = manager.enqueue(request);
            watchForCompletedUpdate(manager, id);
            JSObject result = new JSObject();
            result.put("downloadId", String.valueOf(id));
            call.resolve(result);
        } catch (Exception error) { call.reject("Unable to download update", error); }
    }

    private void watchForCompletedUpdate(DownloadManager manager, long downloadId) {
        pendingUpdateDownloadId = downloadId;
        if (updateDownloadReceiver != null) {
            try { getContext().unregisterReceiver(updateDownloadReceiver); } catch (Exception ignored) { }
        }
        updateDownloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (completedId != pendingUpdateDownloadId) return;
                pendingUpdateDownloadId = -1L;
                try { context.unregisterReceiver(this); } catch (Exception ignored) { }
                updateDownloadReceiver = null;

                DownloadManager.Query query = new DownloadManager.Query().setFilterById(completedId);
                try (android.database.Cursor cursor = manager.query(query)) {
                    if (cursor == null || !cursor.moveToFirst()) return;
                    int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status != DownloadManager.STATUS_SUCCESSFUL) return;
                }
                Uri updateUri = manager.getUriForDownloadedFile(completedId);
                if (updateUri != null) openPackageInstaller(updateUri);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(updateDownloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(updateDownloadReceiver, filter);
        }
    }

    private void openPackageInstaller(Uri updateUri) {
        try {
            Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(updateUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(install);
        } catch (Exception ignored) {
            // The completed Android download notification remains available as a fallback.
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("location", getPermissionState("location").toString());
        result.put("camera", getPermissionState("camera").toString());
        result.put("tracking", DriverLocationService.isTracking(getContext()));
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
