package com.chatify.desktop

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.data["title"] ?: "New message"
        val body = remoteMessage.data["body"] ?: ""
        val targetId = remoteMessage.data["targetId"] ?: ""    // 🔥 sender email / group id
        val isGroup = remoteMessage.data["isGroup"] ?: "false"  // 🔥 group hai ya nahi

        val channelId = "messages"
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New message notifications"
            }
            notificationManager.createNotificationChannel(channel)
        }

        // 🔥 Deep link URI banao - tap karne pe MainActivity ko target chat ka data milega
        val deepLinkUri = Uri.parse("chatify://chat?id=$targetId&group=$isGroup")
        val intent = Intent(Intent.ACTION_VIEW, deepLinkUri, this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(), // unique request code har baar
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setColor(0xFFFF6A00.toInt())
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .setContentIntent(pendingIntent)   // 🔥 tap handling
            .build()

        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notification)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Token refresh yahan aata hai agar Firebase kabhi naya token generate kare.
        // Filhal humara JS-side (login pe) getToken() call hi primary source hai,
        // isliye yahan extra kuch karne ki abhi zaroorat nahi.
    }
}