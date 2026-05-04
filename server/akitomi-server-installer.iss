#define ServerVersion "1.0.0"

[Setup]
AppName=Akitomi 見積書サーバ
AppVersion=2026.1
WizardStyle=modern dynamic
DefaultDirName=C:\AkitomiServer
DefaultGroupName=AkitomiServer
UninstallDisplayIcon={app}\akitomi-server.exe
Compression=lzma2
SolidCompression=yes
OutputBaseFilename=AkitomiMitsumori-Server_{#ServerVersion}-setup
; 管理者権限を必須にする（scコマンドの実行に必要）
PrivilegesRequired=admin

[Files]
; 本体プログラムは常に最新に上書き（ignoreversion）
Source: "target\release\akitomi-server.exe"; DestDir: "{app}"; Flags: ignoreversion

; データベースは「存在しない時だけコピー」かつ「アンインストールで消さない」
Source: "data.db"; DestDir: "{app}"; Flags: onlyifdoesntexist uninsneveruninstall

[Run]
; binPath の中に --service を含め、かつ全体を引用符で囲む
Filename: "{sys}\sc.exe"; Parameters: "create AkitomiServer binPath= ""\""{app}\akitomi-server.exe\"" --service"" start= auto"; Flags: runhidden
; サービス開始
Filename: "{sys}\sc.exe"; Parameters: "start AkitomiServer"; Flags: runhidden

[UninstallRun]
; アンインストール時にサービスを確実に消去する
Filename: "{sys}\sc.exe"; Parameters: "stop AkitomiServer"; Flags: runhidden; RunOnceId: "StopAkitomiServer"
Filename: "{sys}\sc.exe"; Parameters: "delete AkitomiServer"; Flags: runhidden; RunOnceId: "DeleteAkitomiServer"

[UninstallDelete]
; ディレクトリごと消す設定はコメントアウト（または削除）します
; これにより、uninsneveruninstall を指定したファイルや、
; アプリ実行中に生成されたログなどが残っている場合、フォルダ自体も残ります。
; Type: filesandordirs; Name: "{app}"

[Languages]
; 日本語OSの場合は日本語を表示
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
; それ以外の場合は英語を表示
;Name: "english"; MessagesFile: "compiler:Default.isl"
