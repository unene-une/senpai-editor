!macro NSIS_HOOK_PREINSTALL
  # PowerShellを使用してインプットボックスを表示し、入力を取得する
  # NSIS 内で $ をリテラルとして扱うには $$ と記述する必要があります。
  # $0: 終了ステータス, $1: 入力されたテキスト
  nsExec::ExecToStack 'powershell -WindowStyle Hidden -Command "[void][System.Reflection.Assembly]::LoadWithPartialName(\"Microsoft.VisualBasic\"); $$ans = [Microsoft.VisualBasic.Interaction]::InputBox(\"可愛いと言えば？（ローマ字6文字（全部小文字）で）\", \"Senpai Editor インストール認証\"); if ($$ans -eq \"\") { exit 1 } else { Write-Output $$ans }"'
  Pop $0
  Pop $1

  # $0 が 0 以外（キャンセルまたはエラー）の場合は終了
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "パスフレーズが入力されなかったか、エラーが発生したため、インストールを中止します。 (Code: $0)"
    Quit
  ${EndIf}

  # パスフレーズの判定
  # nsExec は標準出力の末尾に改行を加えるため、末尾2文字 (\r\n) を除去します。
  StrLen $2 $1
  ${If} $2 >= 2
    IntOp $2 $2 - 2
    StrCpy $1 $1 $2
  ${EndIf}

  ${If} $1 == "senpai"
    # 正解
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "パスフレーズが正しくありません。インストールを中止します。$\n(入力された値: $1)"
    Quit
  ${EndIf}
!macroend
