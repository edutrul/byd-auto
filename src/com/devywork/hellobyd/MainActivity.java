package com.devywork.hellobyd;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        float density = getResources().getDisplayMetrics().density;
        int padding = Math.round(32 * density);

        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setGravity(Gravity.CENTER);
        screen.setPadding(padding, padding, padding, padding);
        screen.setBackgroundColor(Color.rgb(10, 20, 34));

        TextView title = text("HELLO BYD 👋", 38, Color.WHITE);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        TextView message = text("Custom APK successfully running on DiLink.", 21,
                Color.rgb(198, 218, 236));
        message.setGravity(Gravity.CENTER);
        message.setPadding(0, Math.round(24 * density), 0, 0);

        TextView brand = text("DEVYWORK", 18, Color.rgb(54, 194, 255));
        brand.setGravity(Gravity.CENTER);
        brand.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        brand.setLetterSpacing(0.18f);
        brand.setPadding(0, Math.round(34 * density), 0, 0);

        String orientation = getResources().getConfiguration().orientation
                == Configuration.ORIENTATION_LANDSCAPE ? "LANDSCAPE" : "PORTRAIT";
        TextView status = text("SCREEN: " + orientation, 12, Color.rgb(115, 139, 158));
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, Math.round(18 * density), 0, 0);

        screen.addView(title, wrap());
        screen.addView(message, wrap());
        screen.addView(brand, wrap());
        screen.addView(status, wrap());
        setContentView(screen);
    }

    private TextView text(String value, float sp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        return view;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }
}

