# -*- coding: utf-8 -*-
"""生成高质量爱情对白语音（男声/女声独白或对话）与环境音，编码为 MP3。

方案：edge-tts（微软 Edge 神经网络语音，需联网）
- 女声：zh-CN-XiaoxiaoNeural（晓晓）
- 男声：zh-CN-YunxiNeural（云希）
- 每组主题含多句对白（_f1/_f2... 等），供"尽量不重复"随机播放

环境音：纯合成（白噪声 + 滤波 + 包络），无需版权
- fireworks_fire.mp3：烟花绽放（爆裂声 + 嘶嘶声）
- forest_summer.mp3：夏夜森林（虫鸣 + 微风）
- ocean_waves.mp3：海浪声
- moon_night.mp3：静谧夏夜
- cloud_wind.mp3：云端风声
- snow_fall.mp3：落雪簌簌声
- blossom_breeze.mp3：花雨微风
- aurora_wind.mp3：极地风声
- rose_garden.mp3：花园微风鸟鸣

用法（需安装 edge-tts / miniaudio / lameenc 到 venv）：
  .venv/Scripts/python.exe generate_voices.py
"""
import asyncio
import os
import struct
import tempfile
import math
import random
import edge_tts
import miniaudio
import lameenc

BASE = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE, '..', 'audio', 'voices')
ENV_DIR = os.path.join(BASE, '..', 'audio', 'env')
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(ENV_DIR, exist_ok=True)

FEMALE_VOICE = 'zh-CN-XiaoxiaoNeural'
MALE_VOICE = 'zh-CN-YunxiNeural'
RATE = '+6%'
GAP_SEC = 0.4  # 对话句间停顿（秒）

# =====================================================================
# 每个主题的影视/网络风格对白，含多组（供不重复随机）
# 键: 主题 -> {'f': [女声独白...], 'm': [男声独白...], 'b': [对话列表...]}
# =====================================================================
DIALOGUES = {
    # loveweb4 绚烂烟花
    'fireworks': {
        'f': [
            '烟花再美，也不及你在我身边。你看，它就像我对你的爱，灿烂又永恒。',
            '听说在烟花下许愿会实现。那我许愿，要和你一起看一辈子烟花。',
        ],
        'm': [
            '烟花易冷，人心易变。但我会一直爱你，像这满天的璀璨，永不熄灭。',
            '你看这烟花多美，可在我眼里，都不及你万分之一。',
        ],
        'b': [
            [('m', '快看，烟花！'), ('f', '哇，好美啊！'), ('m', '就像你一样美。'), ('f', '嘴真甜。')],
            [('f', '你说，烟花为什么会消失呢？'), ('m', '因为它把最美的瞬间，留给了夜空。'), ('f', '那我们的爱呢？'), ('m', '我们的爱，是永恒的。')],
        ],
    },
    # loveweb5 玫瑰花园
    'rose': {
        'f': [
            '玫瑰到了花期，我很想你。你要是在我身边该多好。',
            '如果你愿意的话，就把我当成你的玫瑰吧，永远只为你盛开。',
        ],
        'm': [
            '听说玫瑰花语是"我爱你"，那我把这一整片花园都送给你。',
            '你知道吗，玫瑰有刺，但为了你，我愿意拔掉所有的刺。',
        ],
        'b': [
            [('m', '你说，玫瑰为什么有刺？'), ('f', '因为它要保护自己呀。'), ('m', '那我就是你的刺，守护你一辈子。')],
            [('f', '如果我是一朵玫瑰，你愿意做我的园丁吗？'), ('m', '愿意，我会用一生来浇灌你。'), ('f', '那你可要说话算话。')],
        ],
    },
    # loveweb6 海洋之心
    'ocean': {
        'f': [
            '山海自有归期，风雨自有相逢。我们终会相遇。',
            '你像海洋一样深邃，让我心甘情愿地沉溺其中。',
        ],
        'm': [
            '我把思念都沉进了海底，可它还是会浮上来，因为太重了。',
            '就算全世界都沉入海底，我也会游向你，把真心交给你。',
        ],
        'b': [
            [('f', '听说对着海喊一个人的名字，海会把它传到远方。'), ('m', '那我喊你的名字，你能听到吗？'), ('f', '听不到。'), ('m', '那我亲自游到你身边说给你听。')],
            [('m', '如果我变成一条鱼，你愿意做海水吗？'), ('f', '愿意，这样你就永远游在我怀里。'), ('m', '那我们永远不分离。')],
        ],
    },
    # loveweb7 月下柔情
    'moon': {
        'f': [
            '今晚月色真美，风也温柔。就像你在我身边的样子。',
            '月亮很圆，风很温柔，而你在我心上。',
        ],
        'm': [
            '月亮代表我的心，那今晚的月亮一定特别亮，因为我特别想你。',
            '你踏月而来，我便觉得这世间，值得。',
        ],
        'b': [
            [('m', '你看，今晚的月亮好圆。'), ('f', '嗯，像你的眼睛。'), ('m', '那你的眼睛像什么？'), ('f', '像星星，因为我的眼里都是你。')],
            [('f', '听说对着月亮许愿，愿望会实现。'), ('m', '那我们一起许愿吧。'), ('f', '你许了什么愿？'), ('m', '永远和你在一起。')],
        ],
    },
    # loveweb8 云端之恋
    'cloud': {
        'f': [
            '天上的云一朵一朵，都是我想你的样子。',
            '想和你一起飞到云上，把整个世界都看遍。',
        ],
        'm': [
            '我想乘着风，踩着云，去看世界上最美的风景，而你就是风景。',
            '你是云端之上的城市，我愿意为你停留一辈子。',
        ],
        'b': [
            [('f', '如果我是云，你愿意做风吗？'), ('m', '我愿意，因为风能带云去任何地方。'), ('f', '那你要带我去哪？'), ('m', '去我心里。')],
            [('m', '你看，这朵云像不像我们？'), ('f', '像！那你牵着我，我们一起飞。'), ('m', '好，永远不松手。')],
        ],
    },
    # loveweb9 落雪誓言
    'snow': {
        'f': [
            '据说一起看过初雪的人，会一直在一起。那我们约好了哦。',
            '今冬的雪都落尽了，我还是想和你一起白头。',
        ],
        'm': [
            '下雪的时候，整个世界都安静了，只有我的心，在为你跳动。',
            '雪落无声，爱你有声。让我牵着你的手，走到白头。',
        ],
        'b': [
            [('m', '下雪了，陪我去堆雪人吧。'), ('f', '好呀，那我们要堆两个。'), ('m', '为什么要两个？'), ('f', '一个是你，一个是我，永远不分开。')],
            [('f', '雪这么大，你说我们会不会一起白头？'), ('m', '会，我们不仅今天一起白头，这辈子都要一起。'), ('f', '那说好了。')],
        ],
    },
    # loveweb10 萤火森林
    'forest': {
        'f': [
            '林深时见鹿，梦醒时见你。可比起见鹿，我更想见你。',
            '萤火虫的光虽然微弱，但为了你，我愿意照亮整片森林。',
        ],
        'm': [
            '萤火虫的光聚在一起，就能照亮整片森林，就像我对你的爱。',
            '森林很大，可我的目光，始终只追随你一个人。',
        ],
        'b': [
            [('f', '你看，好多萤火虫。'), ('m', '它们都在为我们的相遇发光。'), ('f', '真美，像梦一样。'), ('m', '梦里有你，所以它不是梦。')],
            [('m', '听说萤火虫是为相爱的人点灯的。'), ('f', '那我们，是被祝福的一对吗？'), ('m', '当然，我们会永远幸福。')],
        ],
    },
    # loveweb11 花雨之约
    'blossom': {
        'f': [
            '花开是春的信使，花落是风的情诗。而我，是你的人间。',
            '樱花落下的速度是每秒五厘米，而我走向你的心，只用了一瞬间。',
        ],
        'm': [
            '樱花落下的速度是每秒五厘米，但我走向你的心，只用了一瞬间。',
            '满树繁花，不及你回眸一笑。',
        ],
        'b': [
            [('f', '你看，樱花开了。'), ('m', '花开的时候，我在想你。'), ('f', '那我们每年都一起看花，好吗？'), ('m', '不止一年，是一辈子。')],
            [('m', '如果花瓣有约定，那我们的约定就是永远。'), ('f', '那我们一起在樱花树下，许下誓言。'), ('m', '好，永不反悔。')],
        ],
    },
    # loveweb12 极光之恋
    'aurora': {
        'f': [
            '极光虽然转瞬即逝，但对你的爱，是永恒。',
            '听说在极光下许愿的人，愿望都会实现。那我的愿望，是和你永远在一起。',
        ],
        'm': [
            '听说在极光下许愿的人，愿望都会实现。那我的愿望，是永远和你在一起。',
            '你是我见过的，比极光更美的风景。',
        ],
        'b': [
            [('m', '快看，极光出现了！'), ('f', '好美啊，像梦一样。'), ('m', '那就让极光作证，我永远爱你。'), ('f', '让雪原作证，我永远在你身边。')],
            [('f', '极光这么美，如果有一天消失了怎么办？'), ('m', '不会消失的，就像我对你的爱，永远都在。'), ('f', '那我信你。')],
        ],
    },
}


async def synth_text(text, voice, out_path):
    """合成一段文本到 mp3"""
    c = edge_tts.Communicate(text, voice, rate=RATE)
    await c.save(out_path)


def mp3_to_pcm(path):
    """解码 mp3 → 单声道 16bit PCM 列表"""
    audio = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1)
    return list(audio.samples)


def pcm_to_mp3(samples, path, rate=24000):
    """PCM → mp3（lameenc）"""
    pcm = []
    for v in samples:
        sv = int(max(-1.0, min(1.0, v / 32767.0)) * 32767)
        pcm.append(sv)
    data = b''.join(sv.to_bytes(2, 'little', signed=True) for sv in pcm)
    enc = lameenc.Encoder()
    enc.set_bit_rate(128)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(data) + enc.flush()
    with open(path, 'wb') as f:
        f.write(mp3)


async def gen_dialogue(tmpdir, key, lines):
    """合成一组对话（男女交替）→ PCM 拼接 → 返回 PCM"""
    both_samples = []
    gap = [0] * int(GAP_SEC * 24000)
    for idx, (who, line) in enumerate(lines):
        tmp = os.path.join(tmpdir, '%s_%d.mp3' % (key, idx))
        if who == 'm':
            await synth_text(line, MALE_VOICE, tmp)
        else:
            await synth_text(line, FEMALE_VOICE, tmp)
        both_samples += mp3_to_pcm(tmp) + gap
    return both_samples


# =====================================================================
# 环境音合成（纯程序生成，无版权）
# =====================================================================
SR = 24000

def white_noise(n):
    return [random.uniform(-1, 1) for _ in range(n)]


def lowpass(samples, alpha=0.2):
    """一阶低通滤波（柔和噪声）"""
    out = [0.0] * len(samples)
    prev = 0.0
    for i in range(len(samples)):
        prev = prev + alpha * (samples[i] - prev)
        out[i] = prev
    return out


def apply_envelope(samples, fade_in=0.5, fade_out=1.0):
    n = len(samples)
    fi = int(fade_in * SR)
    fo = int(fade_out * SR)
    out = list(samples)
    for i in range(min(fi, n)):
        out[i] *= i / fi
    for i in range(max(0, n - fo), n):
        out[i] *= (n - i) / fo
    return out


def normalize(samples, peak=0.7):
    m = max(1e-9, max(abs(s) for s in samples))
    scale = peak / m
    return [s * scale for s in samples]


def gen_fireworks_env():
    """烟花绽放：多个爆裂脉冲 + 嘶嘶尾音"""
    dur = 3.0
    n = int(dur * SR)
    out = [0.0] * n
    # 爆裂瞬间（低频轰鸣）
    for _ in range(6):
        pos = random.randint(0, n - 1)
        burst = white_noise(4000)
        burst = lowpass(burst, 0.4)
        for i in range(len(burst)):
            idx = pos + i
            if idx < n:
                out[idx] += burst[i] * math.exp(-i / 1200.0)
    # 嘶嘶尾音
    hiss = lowpass(white_noise(n), 0.6)
    for i in range(n):
        out[i] += hiss[i] * math.exp(-i / (n * 0.6)) * 0.3
    return normalize(apply_envelope(out, 0.02, 0.8))


def gen_forest_summer_env():
    """夏夜森林：虫鸣（高频脉动）+ 微风（低频噪声）"""
    dur = 4.0
    n = int(dur * SR)
    out = [0.0] * n
    # 虫鸣：高频方波状脉动（2~4kHz 嗡嗡）
    for _ in range(20):
        pos = random.randint(0, n - 1)
        f = random.uniform(2000, 3500)
        length = random.randint(int(0.3 * SR), int(0.6 * SR))
        phase = random.uniform(0, math.pi * 2)
        amp = random.uniform(0.4, 0.8)
        for i in range(length):
            idx = pos + i
            if idx < n:
                # 脉动式虫鸣
                mod = max(0, math.sin(i / SR * math.pi * 2 * 40))
                out[idx] += math.sin(phase + i / SR * math.pi * 2 * f) * mod * amp * 0.15
    # 微风
    wind = lowpass(white_noise(n), 0.15)
    for i in range(n):
        out[i] += wind[i] * 0.3 * (0.6 + 0.4 * math.sin(i / SR * math.pi * 2 * 0.3))
    return normalize(apply_envelope(out, 0.5, 1.0))


def gen_ocean_waves_env():
    """海浪：低频噪声波浪（缓慢起伏）"""
    dur = 5.0
    n = int(dur * SR)
    noise = lowpass(white_noise(n), 0.1)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        # 波浪包络
        wave_env = (0.5 + 0.5 * math.sin(t * math.pi * 2 * 0.2)) ** 2
        out[i] = noise[i] * (0.4 + 0.6 * wave_env)
    return normalize(apply_envelope(out, 0.8, 1.5))


def gen_night_env():
    """静谧夏夜：轻柔虫鸣 + 远处微风"""
    dur = 4.0
    n = int(dur * SR)
    out = [0.0] * n
    for _ in range(12):
        pos = random.randint(0, n - 1)
        f = random.uniform(2500, 4000)
        length = random.randint(int(0.2 * SR), int(0.4 * SR))
        phase = random.uniform(0, math.pi * 2)
        for i in range(length):
            idx = pos + i
            if idx < n:
                mod = max(0, math.sin(i / SR * math.pi * 2 * 30))
                out[idx] += math.sin(phase + i / SR * math.pi * 2 * f) * mod * 0.12
    wind = lowpass(white_noise(n), 0.1)
    for i in range(n):
        out[i] += wind[i] * 0.2
    return normalize(apply_envelope(out, 0.5, 1.0))


def gen_wind_env():
    """风声：柔和低频噪声（起伏）"""
    dur = 4.0
    n = int(dur * SR)
    noise = lowpass(white_noise(n), 0.08)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        out[i] = noise[i] * (0.5 + 0.5 * math.sin(t * math.pi * 2 * 0.25))
    return normalize(apply_envelope(out, 0.5, 1.0))


def gen_snow_env():
    """落雪簌簌：轻微高频颗粒 + 静谧低噪"""
    dur = 4.0
    n = int(dur * SR)
    out = [0.0] * n
    # 细小颗粒（高频短促）
    for _ in range(60):
        pos = random.randint(0, n - 1)
        length = random.randint(50, 200)
        for i in range(length):
            idx = pos + i
            if idx < n:
                out[idx] += (random.uniform(-1, 1)) * 0.15 * (1 - i / length)
    # 静谧底噪
    base = lowpass(white_noise(n), 0.05)
    for i in range(n):
        out[i] += base[i] * 0.25
    return normalize(apply_envelope(out, 0.5, 1.0))


def gen_breeze_env():
    """花雨微风：柔和高频沙沙 + 微风"""
    dur = 4.0
    n = int(dur * SR)
    out = [0.0] * n
    # 花瓣沙沙（高频）
    for _ in range(40):
        pos = random.randint(0, n - 1)
        length = random.randint(100, 400)
        f = random.uniform(500, 1500)
        phase = random.uniform(0, math.pi * 2)
        for i in range(length):
            idx = pos + i
            if idx < n:
                out[idx] += math.sin(phase + i / SR * math.pi * 2 * f) * 0.1 * (1 - i / length)
    wind = lowpass(white_noise(n), 0.12)
    for i in range(n):
        out[i] += wind[i] * 0.3
    return normalize(apply_envelope(out, 0.5, 1.0))


def gen_arctic_env():
    """极地风声：空旷低频风声"""
    dur = 5.0
    n = int(dur * SR)
    noise = lowpass(white_noise(n), 0.05)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        out[i] = noise[i] * (0.4 + 0.6 * math.sin(t * math.pi * 2 * 0.12 + 1))
    return normalize(apply_envelope(out, 1.0, 1.5))


def gen_garden_env():
    """花园微风鸟鸣：微风 + 偶尔鸟叫"""
    dur = 5.0
    n = int(dur * SR)
    out = [0.0] * n
    wind = lowpass(white_noise(n), 0.12)
    for i in range(n):
        out[i] = wind[i] * 0.3
    # 鸟鸣（短促啁啾）
    for _ in range(3):
        pos = random.randint(int(0.5 * SR), int(dur * SR) - int(1 * SR))
        length = random.randint(int(0.15 * SR), int(0.3 * SR))
        f = random.uniform(2000, 4000)
        for i in range(length):
            idx = pos + i
            if idx < n:
                chirp = math.sin(i / SR * math.pi * 2 * f) * math.exp(-i / (0.1 * SR))
                out[idx] += chirp * 0.5
    return normalize(apply_envelope(out, 0.5, 1.0))


ENV_GENERATORS = {
    'fireworks_fire': gen_fireworks_env,
    'forest_summer': gen_forest_summer_env,
    'ocean_waves': gen_ocean_waves_env,
    'moon_night': gen_night_env,
    'cloud_wind': gen_wind_env,
    'snow_fall': gen_snow_env,
    'blossom_breeze': gen_breeze_env,
    'aurora_wind': gen_arctic_env,
    'rose_garden': gen_garden_env,
}


async def main():
    tmpdir = tempfile.mkdtemp()

    # ---- 生成对白 ----
    for theme, dlg in DIALOGUES.items():
        for i, line in enumerate(dlg['f']):
            f_path = os.path.join(AUDIO_DIR, '%s_female%d.mp3' % (theme, i + 1))
            await synth_text(line, FEMALE_VOICE, f_path)
            print('written:', f_path)
        for i, line in enumerate(dlg['m']):
            m_path = os.path.join(AUDIO_DIR, '%s_male%d.mp3' % (theme, i + 1))
            await synth_text(line, MALE_VOICE, m_path)
            print('written:', m_path)
        for i, lines in enumerate(dlg['b']):
            samples = await gen_dialogue(tmpdir, theme + '_b' + str(i), lines)
            b_path = os.path.join(AUDIO_DIR, '%s_both%d.mp3' % (theme, i + 1))
            pcm_to_mp3(samples, b_path)
            print('written:', b_path)

    # ---- 生成环境音 ----
    for name, fn in ENV_GENERATORS.items():
        samples = fn()
        # 转 16bit int
        pcm_int = [int(max(-1.0, min(1.0, s)) * 32767) for s in samples]
        pcm_to_mp3(pcm_int, os.path.join(ENV_DIR, name + '.mp3'))
        print('env written:', name)

    print('ALL DONE')


if __name__ == '__main__':
    asyncio.run(main())
