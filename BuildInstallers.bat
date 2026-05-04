@echo off
:: 文字コードを UTF-8 に変更
chcp 65001 > nul

setlocal

echo "==== START Client ===="
pushd client
:: クライアントをビルド
call npm install
call npm run tauri build
popd
echo "==== END Client ===="

echo "==== START Server ===="
pushd server
:: Rustサーバをビルド
call cargo build --release

:: バッチファイルがある場所を基準にパスを設定
set BUILD_DIR=%CD%
set ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe

if not exist "%ISCC%" (
  echo ERROR: "%ISCC%" is not exist.
  goto :server_error
)
if not exist "%BUILD_DIR%\akitomi-server-installer.iss" (
  echo ERROR: "%BUILD_DIR%\akitomi-server-installer.iss" is not exist.
  goto :server_error
)
"%ISCC%" "%BUILD_DIR%\akitomi-server-installer.iss"
echo "==== END Server ===="

:server_error

popd
