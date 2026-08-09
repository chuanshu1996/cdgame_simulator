@echo off
setlocal enabledelayedexpansion
:: 切换到目标目录
cd /d "F:\work\cdgame\omj_simulator-master\public\avatar"
:: 遍历所有png文件，以-为分隔符，去掉-前的部分并重命名
for /f "delims=- tokens=1*" %%i in ('dir /b /a-d *.png') do (
    ren "%%i-%%j" "%%j"
)
echo 所有png文件重命名完成！
endlocal
pause