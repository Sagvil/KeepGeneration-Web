import os
import threading
import time
from flask import Flask, render_template, request, send_file, redirect, url_for, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime
from PIL import Image
from KeepSultan import KeepSultan

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_fallback_secret_key_change_me')
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['OUTPUT_FOLDER'] = 'static/output'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB限制
app.config['FILE_MAX_AGE_SECONDS'] = int(os.environ.get('FILE_MAX_AGE_SECONDS', 1 * 60 * 60))
app.config['CLEANUP_INTERVAL_SECONDS'] = int(os.environ.get('CLEANUP_INTERVAL_SECONDS', 30 * 60))

DEFAULT_AVATAR = 'static/default_avatar.png'
MAP_PRESETS = {
    '通用地图（无明显地理标识）': 'static/maps/default.png',
    'SYSU东校园体育场1': 'static/maps/map6.png',
    'SYSU东校园体育场2': 'static/maps/map15.png',
    'SYSU东校园体育场3': 'static/maps/map16.png',
    'SYSU东校园体育场4': 'static/maps/map17.png',
    'SYSU东校园体育场5': 'static/maps/map18.png',
    'SYSU东校园体育场6': 'static/maps/map19.png',
    'SYSU东校园体育场7': 'static/maps/map20.png',
    'SYSU东校园环形大圈': 'static/maps/map7.png',
    '大学城中环路': 'static/maps/map13.png',
    'SYSU南校园英东体育场': 'static/maps/map4.png',
    'SYSU南校园大圈': 'static/maps/map1.png',
    'SYSU南校园小圈': 'static/maps/map2.png',
    'SYSU南校园中轴线': 'static/maps/map3.png',
    'SYSU南校园珠江南岸': 'static/maps/map5.png',
    '二沙岛': 'static/maps/map12.png',
    '花城广场': 'static/maps/map14.png',
    'SYSU珠海校区': 'static/maps/map8.png',
    '苏州大学': 'static/maps/map9.png',
    '中央财经大学': 'static/maps/map10.png',
    '中南大学': 'static/maps/map11.png'
}

# 创建必要目录
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)


def cleanup_old_files(folder_path, max_age_seconds):
    now = time.time()
    for root, _, files in os.walk(folder_path):
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                if not os.path.isfile(file_path):
                    continue
                if now - os.path.getmtime(file_path) > max_age_seconds:
                    os.remove(file_path)
                    app.logger.info("Removed stale file: %s", file_path)
            except FileNotFoundError:
                continue
            except Exception as exc:
                app.logger.warning("Failed to remove file %s: %s", file_path, exc)


def start_cleanup_scheduler():
    def _run_cleanup_loop():
        while True:
            try:
                max_age = app.config['FILE_MAX_AGE_SECONDS']
                for folder in (app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER']):
                    cleanup_old_files(folder, max_age)
            except Exception as exc:
                app.logger.error("Error during scheduled cleanup: %s", exc)
            time.sleep(app.config['CLEANUP_INTERVAL_SECONDS'])

    thread = threading.Thread(target=_run_cleanup_loop, daemon=True, name="cleanup-worker")
    thread.start()
    return thread


if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    start_cleanup_scheduler()

# 默认配置
DEFAULT_CONFIG = {
    "template": "static/default_template.png",
    "map": "static/maps/default.png",
    "username": "Keep User",
    "date": datetime.now().strftime("%Y-%m-%d"),
    "end_time": datetime.now().strftime("%H:%M"),
    "location": "广州市",
    "weather": "多云",
    "temperature": "20°C",
    "total_km": [4.02, 4.3],
    "sport_time": ["00:23:00", "00:25:00"],
    "total_time": ["00:27:00", "00:31:00"],
    "cumulative_climb": [90, 96],
    "average_cadence": [90, 99],
    "exercise_load": [70, 90]
}

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html', default_config=DEFAULT_CONFIG,map_presets=MAP_PRESETS.keys())

def handle_upload(field_name, file_type):
    if field_name not in request.files:
        return None
    file = request.files[field_name]
    if file.filename == '':
        return None
    if file and allowed_file(file.filename):
        img = Image.open(file.stream)
        img = img.convert("RGBA")
        filename = f"{file_type}_{int(datetime.now().timestamp())}.png"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img.save(save_path, format="PNG")
        return save_path
    return None

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'webp'}

def generate_image(template_path, map_path, avatar_path, params, output_path):
    ks = KeepSultan()
    
    # 配置参数
    ks.configs.update({
        'template': template_path,
        'map': map_path,
        'avatar': avatar_path,
        'username': params['username'],
        'date': params['date'].replace('-', '/'),
        'location': params['location'],
        'weather': params['weather'],
        'temperature': params['temperature'],
        'end_time': params['end_time'],
        'total_km': params['total_km'],
        'sport_time': params['sport_time'],
        'total_time': params['total_time'],
        'cumulative_climb': params['cumulative_climb'],
        'average_cadence': params['average_cadence'],
        'exercise_load': params['exercise_load']
    })
    
    # 生成图片
    ks.process()
    ks.save(output_path)

@app.route('/api/generate', methods=['POST'])
def api_generate():
    try:
        # 处理文件上传
        map_selection = request.form.get('map_preset')
        
        # 确定最终地图路径
        map_path = handle_upload('custom_map', 'map') or MAP_PRESETS.get(map_selection, DEFAULT_CONFIG['map'])
        
        # 处理头像文件
        avatar_path = handle_upload('avatar', 'avatar') or DEFAULT_AVATAR

        # 获取表单参数
        # 使用 or 运算符处理空字符串情况，防止 float转换失败
        def get_val(key, default):
            val = request.form.get(key)
            return val if val else default

        form_data = {
            'username': get_val('username', DEFAULT_CONFIG['username']),
            'date': get_val('date', DEFAULT_CONFIG['date']),
            'location': get_val('location', DEFAULT_CONFIG['location']),
            'weather': get_val('weather', DEFAULT_CONFIG['weather']),
            'temperature': get_val('temperature', DEFAULT_CONFIG['temperature']),
            'end_time': get_val('end_time', DEFAULT_CONFIG['end_time']),
            'total_km': [
                float(get_val('total_km_min', DEFAULT_CONFIG['total_km'][0])),
                float(get_val('total_km_max', DEFAULT_CONFIG['total_km'][1]))
            ],
            'sport_time': [
                get_val('sport_time_min', DEFAULT_CONFIG['sport_time'][0]),
                get_val('sport_time_max', DEFAULT_CONFIG['sport_time'][1])
            ],
            'total_time': [
                get_val('total_time_min', DEFAULT_CONFIG['total_time'][0]),
                get_val('total_time_max', DEFAULT_CONFIG['total_time'][1])
            ],
            'cumulative_climb': [
                int(get_val('cumulative_climb_min', DEFAULT_CONFIG['cumulative_climb'][0])),
                int(get_val('cumulative_climb_max', DEFAULT_CONFIG['cumulative_climb'][1]))
            ],
            'average_cadence': [
                int(get_val('average_cadence_min', DEFAULT_CONFIG['average_cadence'][0])),
                int(get_val('average_cadence_max', DEFAULT_CONFIG['average_cadence'][1]))
            ],
            'exercise_load': [
                int(get_val('exercise_load_min', DEFAULT_CONFIG['exercise_load'][0])),
                int(get_val('exercise_load_max', DEFAULT_CONFIG['exercise_load'][1]))
            ]
        }

        # 生成图片
        output_filename = f"result_{datetime.now().strftime('%Y%m%d%H%M%S')}.png"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        generate_image(
            DEFAULT_CONFIG['template'],
            map_path or DEFAULT_CONFIG['map'],
            avatar_path,
            form_data,
            output_path
        )
        
        return jsonify({
            "success": True,
            "image_url": url_for('static', filename=f'output/{output_filename}'),
            "download_url": url_for('download', filename=output_filename)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/download/<filename>')
def download(filename):
    return send_file(
        os.path.join(app.config['OUTPUT_FOLDER'], filename),
        as_attachment=True,
        download_name=f"keep_result_{datetime.now().strftime('%Y%m%d')}.png"
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5010, debug=False)