@echo off
:: 文字コードを UTF-8 に変更
chcp 65001 > nul

setlocal

pushd client
:: クライアントをビルド
call npm install
call npm run tauri build
echo "==== Client installer created. ===="
echo ".\client\src-tauri\target\release\akitomi-mitsumori.exe"
popd

pushd server
:: Rustサーバをビルド
call cargo build --release

:: バッチファイルがある場所を基準にパスを設定
set BUILD_DIR=%CD%
REM set ISCC="C:\Users\coyac\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

%ISCC% "%BUILD_DIR%\akitomi-server-installer.iss"
echo "==== Server installer created. ===="

popd
