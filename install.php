<?php
// ============================================================
//  BODHI INSTALL — setup database sekali saja
//  1. Upload file ini ke public_html/
//  2. Buka: yourdomain.com/install.php
//  3. Isi form → klik Install
//  4. HAPUS file ini setelah berhasil!
// ============================================================
$msg = ''; $success = false; $apiKeyGenerated = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $host   = trim($_POST['host'] ?? 'localhost');
    $dbname = trim($_POST['dbname'] ?? '');
    $user   = trim($_POST['user'] ?? '');
    $pass   = trim($_POST['pass'] ?? '');
    $apikey = trim($_POST['apikey'] ?? 'bodhi2024secret');

    if (!$dbname || !$user) {
        $msg = '⚠️ Nama database dan username wajib diisi.';
    } else {
        try {
            $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $pdo->exec("CREATE TABLE IF NOT EXISTS bodhi_data (
                `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
                `value`     LONGTEXT,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Update api.php config
            $apiFile = __DIR__ . '/api.php';
            if (file_exists($apiFile)) {
                $content = file_get_contents($apiFile);
                $content = preg_replace("/define\('DB_HOST',.*?\);/", "define('DB_HOST', '$host');", $content);
                $content = preg_replace("/define\('DB_NAME',.*?\);/", "define('DB_NAME', '$dbname');", $content);
                $content = preg_replace("/define\('DB_USER',.*?\);/", "define('DB_USER', '$user');", $content);
                $content = preg_replace("/define\('DB_PASS',.*?\);/", "define('DB_PASS', '$pass');", $content);
                $content = preg_replace("/define\('API_KEY',.*?\);/", "define('API_KEY', '$apikey');", $content);
                file_put_contents($apiFile, $content);
                $apiKeyGenerated = $apikey;
                $success = true;
                $msg = '✅ Berhasil! Database sudah siap. Sekarang update API_KEY di index.html, lalu hapus file install.php ini.';
            } else {
                $msg = '⚠️ File api.php tidak ditemukan. Pastikan sudah diupload ke folder yang sama.';
            }
        } catch (Exception $e) {
            $msg = '❌ Gagal koneksi: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BODHI — Database Setup</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#f5ede4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border-radius:16px;padding:36px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.1)}
  h1{font-size:22px;margin-bottom:6px;color:#1e1810}
  .sub{font-size:14px;color:#9a8e82;margin-bottom:28px}
  label{display:block;font-size:12px;font-weight:700;color:#4a3f35;margin-bottom:6px;margin-top:16px;text-transform:uppercase;letter-spacing:.4px}
  input{width:100%;padding:10px 14px;border:1.5px solid #e5ddd3;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:.2s}
  input:focus{border-color:#c85b2a}
  .hint{font-size:11px;color:#9a8e82;margin-top:4px}
  button{width:100%;margin-top:24px;padding:13px;background:#c85b2a;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
  button:hover{background:#a04520}
  .msg{margin-top:20px;padding:14px 16px;border-radius:10px;font-size:13px;line-height:1.6;font-weight:500}
  .msg.ok{background:#e2f0e7;color:#1a5c30;border:1px solid #90d0a8}
  .msg.err{background:#fdeaea;color:#7a1a1a;border:1px solid #f0a0a0}
  .api-box{margin-top:14px;background:#1e1810;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:13px;color:#f0d090;word-break:break-all}
  .steps{margin-top:16px;font-size:12px;color:#4a3f35;line-height:1.8}
  .steps li{margin-bottom:4px}
  .warn{margin-top:14px;padding:10px 14px;background:#fff8e0;border:1px solid #f0d060;border-radius:8px;font-size:12px;color:#7a5a00}
</style>
</head>
<body>
<div class="card">
  <h1>🛠 BODHI Database Setup</h1>
  <p class="sub">Jalankan sekali saja untuk menghubungkan website ke database.</p>

  <?php if ($success): ?>
    <div class="msg ok">
      <?= $msg ?><br><br>
      <strong>API Key kamu:</strong>
      <div class="api-box"><?= htmlspecialchars($apiKeyGenerated) ?></div>
    </div>
    <div class="steps">
      <strong>Langkah selanjutnya:</strong>
      <ol style="margin-top:8px;padding-left:18px">
        <li>Buka <strong>index.html</strong> dengan text editor</li>
        <li>Cari <code>var API_KEY = ''</code></li>
        <li>Isi dengan API key di atas</li>
        <li>Re-upload <strong>index.html</strong> ke hosting</li>
        <li><strong>Hapus file install.php</strong> dari hosting!</li>
      </ol>
    </div>
    <div class="warn">⚠️ <strong>Hapus install.php</strong> setelah selesai untuk keamanan!</div>
  <?php else: ?>
    <?php if ($msg): ?>
      <div class="msg err"><?= $msg ?></div>
    <?php endif; ?>
    <form method="POST">
      <label>DB Host</label>
      <input name="host" value="localhost" placeholder="localhost">
      <span class="hint">Biasanya "localhost" untuk shared hosting</span>

      <label>Nama Database</label>
      <input name="dbname" value="<?= htmlspecialchars($_POST['dbname']??'') ?>" placeholder="Contoh: user123_bodhi">
      <span class="hint">Buat dulu di cPanel → MySQL Databases</span>

      <label>Username Database</label>
      <input name="user" value="<?= htmlspecialchars($_POST['user']??'') ?>" placeholder="Contoh: user123_bodhi">

      <label>Password Database</label>
      <input name="pass" type="password" placeholder="Password yang kamu buat di cPanel">

      <label>API Key (kunci keamanan)</label>
      <input name="apikey" value="bodhi2024secret" placeholder="Ganti dengan kata unik kamu">
      <span class="hint">Ini akan disimpan di api.php dan index.html — jangan share ke orang lain</span>

      <button type="submit">⚡ Install Sekarang</button>
    </form>
  <?php endif; ?>
</div>
</body>
</html>
