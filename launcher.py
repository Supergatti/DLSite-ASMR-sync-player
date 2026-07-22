import ipaddress
import os
import socket
import threading
import time
import webbrowser

from server import app, MEDIA_ROOTS, MEDIA_ROOTS_CONFIG

try:
    from waitress import serve as waitress_serve
except ImportError:
    waitress_serve = None


def find_free_port(preferred=5000):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('0.0.0.0', preferred))
        sock.listen(1)
        return preferred
    except OSError:
        sock.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('0.0.0.0', 0))
        return sock.getsockname()[1]
    finally:
        sock.close()


def get_lan_addresses():
    benchmark_network = ipaddress.ip_network('198.18.0.0/15')

    def is_usable(address):
        parsed = ipaddress.ip_address(address)
        return not parsed.is_loopback and not parsed.is_link_local and parsed not in benchmark_network

    # Ask the routing table which local address would be used for outbound traffic.
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(('8.8.8.8', 80))
        primary_address = probe.getsockname()[0]
        if is_usable(primary_address):
            return [primary_address]
    except OSError:
        pass
    finally:
        probe.close()

    addresses = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass

    usable_addresses = [address for address in addresses if is_usable(address)]

    def address_priority(address):
        parsed = ipaddress.ip_address(address)
        if parsed in ipaddress.ip_network('192.168.0.0/16'):
            return 0
        if parsed in ipaddress.ip_network('10.0.0.0/8'):
            return 1
        if parsed in ipaddress.ip_network('172.16.0.0/12'):
            return 2
        return 3

    return sorted(usable_addresses, key=lambda address: (address_priority(address), address))


def run_server(host, port):
    try:
        if waitress_serve:
            waitress_serve(app, host=host, port=port, threads=8)
        else:
            print('Waitress is not installed; using the Flask server for this run.')
            print('Run "pip install -r requirements.txt" before regular LAN use.')
            app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)
    except Exception as exc:
        print('Failed to start server:', exc)


def main():
    host = '0.0.0.0'
    preferred_port = int(os.environ.get('DLSITE_PORT', '5000'))
    port = find_free_port(preferred_port)
    local_url = f'http://127.0.0.1:{port}/'

    print('DLSite ASMR Sync Player is starting...')
    print(f'Media library config: {MEDIA_ROOTS_CONFIG}')
    for root in MEDIA_ROOTS.values():
        status = 'ready' if root['path'].is_dir() else 'missing'
        print(f"  [{status}] {root['name']}: {root['path']}")

    server_thread = threading.Thread(
        target=run_server,
        args=(host, port),
        daemon=True,
    )
    server_thread.start()
    time.sleep(1)

    print(f'PC: {local_url}')
    lan_addresses = get_lan_addresses()
    if lan_addresses:
        for address in lan_addresses:
            print(f'iPad/LAN: http://{address}:{port}/')
    else:
        print('LAN address was not detected. Run ipconfig to find the PC IPv4 address.')

    if os.environ.get('DLSITE_NO_BROWSER') != '1':
        try:
            webbrowser.open(local_url)
        except Exception as exc:
            print('Could not open the browser automatically:', exc)

    hold_seconds = os.environ.get('DLSITE_HOLD_SECONDS')
    if hold_seconds:
        time.sleep(max(0, float(hold_seconds)))
    else:
        print('Press Enter in this window to stop the player.')
        try:
            input()
        except EOFError:
            pass


if __name__ == '__main__':
    main()
