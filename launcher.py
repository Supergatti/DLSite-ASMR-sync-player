import threading
import time
import webbrowser
import socket

from server import app, MEDIA_DIR


def find_free_port(preferred=5000):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', preferred))
        s.listen(1)
        s.close()
        return preferred
    except OSError:
        try:
            s.close()
        except Exception:
            pass
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
        s.close()
        return port


def run_server(host, port):
    try:
        # 确保禁用调试和热重载（打包时会造成问题）
        app.run(host=host, port=port, debug=False, use_reloader=False)
    except Exception as e:
        print("启动服务器失败：", e)


def main():
    host = '127.0.0.1'
    port = find_free_port(5000)
    url = f"http://{host}:{port}/"

    print("DLSite ASMR 同步播放器 正在加载...")
    print(f"媒体目录: {MEDIA_DIR}")

    # 在后台线程启动 Flask 服务
    t = threading.Thread(target=run_server, args=(host, port), daemon=True)
    t.start()

    # 等待短时间让服务器启动
    time.sleep(1)

    print(f"打开：{url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print("自动打开浏览器失败：", e)

    print("点击浏览器中的链接使用；在此窗口按回车退出程序。")
    try:
        input()
    except EOFError:
        pass


if __name__ == '__main__':
    main()
