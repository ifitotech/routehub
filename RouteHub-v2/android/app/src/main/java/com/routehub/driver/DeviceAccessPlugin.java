package com.routehub.driver;

import android.Manifest;
import android.content.Intent;
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
