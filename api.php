<?php
// ============================================================
//  BODHI API — simpan & load semua data website
//  Upload file ini ke public_html/ di hosting kamu
// ============================================================

// ---- KONFIGURASI DATABASE (isi sesuai cPanel kamu) --------
define('DB_HOST', 'localhost');
define('DB_NAME', 'isi_nama_database');   // dari cPanel > MySQL Databases
define('DB_USER', 'isi_username_db');     // dari cPanel > MySQL Databases
define('DB_PASS', 'isi_password_db');     // password saat buat user DB
define('API_KEY', 'bodhi2024secret');     // kunci rahasia, boleh diganti
// -----------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Auth check
$key = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : (isset($_GET['k']) ? $_GET['k'] : '');
if ($key !== API_KEY) {
    // Allow load without key (public read), but require key for write
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

// DB connection
try {
    $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: '.$e->getMessage()]);
    exit;
}

// Create table if not exists
$pdo->exec("CREATE TABLE IF NOT EXISTS bodhi_data (
    `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
    `value`     LONGTEXT,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['action'] ?? 'load') : '';

// ---- GET: load all data ----
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query("SELECT `key`, `value` FROM bodhi_data")->fetchAll();
    $data = [];
    foreach ($rows as $row) $data[$row['key']] = $row['value'];
    echo json_encode(['ok' => true, 'data' => $data]);
    exit;
}

// ---- POST: save data ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { echo json_encode(['error' => 'Invalid JSON']); exit; }

    $action = $body['action'] ?? '';

    // Save single key
    if ($action === 'save' && isset($body['key'])) {
        $stmt = $pdo->prepare("INSERT INTO bodhi_data (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)");
        $stmt->execute([$body['key'], $body['value']]);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Save batch
    if ($action === 'save_batch' && isset($body['data'])) {
        $stmt = $pdo->prepare("INSERT INTO bodhi_data (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)");
        $pdo->beginTransaction();
        foreach ($body['data'] as $k => $v) {
            $stmt->execute([$k, $v]);
        }
        $pdo->commit();
        echo json_encode(['ok' => true, 'saved' => count($body['data'])]);
        exit;
    }

    // Delete key
    if ($action === 'delete' && isset($body['key'])) {
        $pdo->prepare("DELETE FROM bodhi_data WHERE `key`=?")->execute([$body['key']]);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Delete all (reset)
    if ($action === 'reset_all') {
        $pdo->exec("DELETE FROM bodhi_data");
        echo json_encode(['ok' => true]);
        exit;
    }

    echo json_encode(['error' => 'Unknown action']);
}
