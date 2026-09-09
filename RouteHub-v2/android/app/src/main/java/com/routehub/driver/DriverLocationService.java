package com.routehub.driver;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** User-visible, opt-in location sharing for an active Driving Day. */
public class DriverLocationService extends Service implements LocationListener {
    static final String ACTION_START = "com.routehub.driver.START_LOCATION_TRACKING";
    static final String ACTION_STOP = "com.routehub.driver.STOP_LOCATION_TRACKING";
    private static final String CHANNEL_ID = "routehub_location_sharing";
    private static final int NOTIFICATION_ID = 4102;
    private static final String PREFS = "routehub_location_service";
    private static final String TRACKING = "tracking";
    private static final String TAG = "RouteHubLocation";

    private LocationManager locationManager;
    private long intervalMillis = 20 * 60 * 1000L;
    private long lastUploadAt = 0L;
    private String supabaseUrl, anonKey, accessToken, refreshToken, sessionId, driverId;

    @Override public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) { stopTracking(); return START_NOT_STICKY; }
        if (intent == null || !readConfiguration(intent)) { stopTracking(); return START_NOT_STICKY; }
        startVisibleService();
        if (!hasLocationPermission()) { stopTracking(); return START_NOT_STICKY; }
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING, true).apply();
        requestUpdates();
        uploadLastKnownLocation();
        return START_NOT_STICKY;
    }

    private boolean readConfiguration(Intent intent) {
        supabaseUrl = intent.getStringExtra("supabaseUrl"); anonKey = intent.getStringExtra("supabaseAnonKey");
        accessToken = intent.getStringExtra("accessToken"); refreshToken = intent.getStringExtra("refreshToken");
        sessionId = intent.getStringExtra("sessionId"); driverId = intent.getStringExtra("driverId");
        int minutes = intent.getIntExtra("intervalMinutes", 20);
        intervalMillis = (minutes <= 5 ? 5L : 20L) * 60L * 1000L;
        return supabaseUrl != null && supabaseUrl.startsWith("https://") && nonEmpty(anonKey) && nonEmpty(accessToken)
            && nonEmpty(refreshToken) && nonEmpty(sessionId) && nonEmpty(driverId);
    }
    private boolean nonEmpty(String value) { return value != null && !value.isEmpty(); }
    private boolean hasLocationPermission() {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void startVisibleService() {
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.routehub_icon).setContentTitle("RouteHub location sharing")
            .setContentText("Sharing your work location. Tap to open RouteHub and end Driving Day.")
            .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE).build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(NOTIFICATION_ID, notification);
    }
    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Location sharing", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Visible while RouteHub shares a driver's work location.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
    private void requestUpdates() {
        if (locationManager == null || !hasLocationPermission()) return;
        locationManager.removeUpdates(this);
        try {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, intervalMillis, 0f, this);
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, intervalMillis, 0f, this);
        } catch (SecurityException error) { Log.w(TAG, "Location permission was removed", error); stopTracking(); }
    }
    private void uploadLastKnownLocation() {
        if (locationManager == null || !hasLocationPermission()) return;
        Location newest = null;
        try {
            for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                Location candidate = locationManager.getLastKnownLocation(provider);
                if (candidate != null && (newest == null || candidate.getTime() > newest.getTime())) newest = candidate;
            }
        } catch (SecurityException ignored) { }
        if (newest != null) uploadIfDue(newest, true);
    }
    @Override public void onLocationChanged(Location location) { uploadIfDue(location, false); }
    private void uploadIfDue(Location location, boolean immediate) {
        if (location == null || !Double.isFinite(location.getLatitude()) || !Double.isFinite(location.getLongitude())) return;
        long now = System.currentTimeMillis();
        if (!immediate && lastUploadAt > 0 && now - lastUploadAt < intervalMillis - 15_000L) return;
        lastUploadAt = now;
        final double lat = location.getLatitude(), lng = location.getLongitude();
        final float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0f;
        new Thread(() -> upload(lat, lng, accuracy), "RouteHubLocationUpload").start();
    }
    private void upload(double lat, double lng, float accuracy) {
        try {
            int response = patchLocation(lat, lng, accuracy);
            if (response == HttpURLConnection.HTTP_UNAUTHORIZED && refreshAccessToken()) response = patchLocation(lat, lng, accuracy);
            if (response < 200 || response >= 300) Log.w(TAG, "Location sync failed with HTTP " + response);
        } catch (Exception error) { Log.w(TAG, "Location sync unavailable", error); }
    }
    private int patchLocation(double lat, double lng, float accuracy) throws Exception {
        String query = "id=eq." + URLEncoder.encode(sessionId, "UTF-8") + "&driver_id=eq." + URLEncoder.encode(driverId, "UTF-8") + "&status=eq.active";
        HttpURLConnection connection = (HttpURLConnection) new URL(supabaseUrl + "/rest/v1/driving_sessions?" + query).openConnection();
        connection.setRequestMethod("PATCH"); connection.setConnectTimeout(15_000); connection.setReadTimeout(15_000); connection.setDoOutput(true);
        connection.setRequestProperty("apikey", anonKey); connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Prefer", "return=minimal");
        JSONObject body = new JSONObject(); body.put("last_lat", lat); body.put("last_lng", lng); body.put("last_accuracy", accuracy); body.put("last_updated_at", java.time.Instant.now().toString());
        try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        int response = connection.getResponseCode(); connection.disconnect(); return response;
    }
    private boolean refreshAccessToken() {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token").openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(15_000); connection.setReadTimeout(15_000); connection.setDoOutput(true);
            connection.setRequestProperty("apikey", anonKey); connection.setRequestProperty("Content-Type", "application/json");
            JSONObject body = new JSONObject().put("refresh_token", refreshToken);
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = connection.getResponseCode(); if (code < 200 || code >= 300) { connection.disconnect(); return false; }
            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new java.io.InputStreamReader(connection.getInputStream()))) { String line; while ((line = reader.readLine()) != null) response.append(line); }
            connection.disconnect(); JSONObject tokens = new JSONObject(response.toString());
            accessToken = tokens.optString("access_token", ""); refreshToken = tokens.optString("refresh_token", refreshToken); return !accessToken.isEmpty();
        } catch (Exception error) { Log.w(TAG, "Session refresh unavailable", error); return false; }
    }
    private void stopTracking() {
        if (locationManager != null) try { locationManager.removeUpdates(this); } catch (SecurityException ignored) { }
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING, false).apply();
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    public static boolean isTracking(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(TRACKING, false); }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onDestroy() { if (locationManager != null) try { locationManager.removeUpdates(this); } catch (SecurityException ignored) { } getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING, false).apply(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
