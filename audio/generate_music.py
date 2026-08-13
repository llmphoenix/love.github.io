# -*- coding: utf-8 -*-
"""生成原创爱情钢琴纯音乐（无版权），编码为 MP3。

使用 lameenc 编码。每首曲子为原创旋律，包含：
- 钢琴音色：基频 + 少量泛音 + 指数衰减包络
- 和弦伴奏（琶音/分解和弦）
- 混响尾音、淡入淡出
"""
import math
import wave
import os
import lameenc

SAMPLE_RATE = 44100
AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def note_freq(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))

def midi(name, octave):
    """如 midi('C', 5) -> 中央C上方的C（MIDI 72）"""
    semitone = NOTE_NAMES.index(name)
    return 12 * (octave + 1) + semitone

def piano_tone(freq, duration, sample_rate=SAMPLE_RATE, vel=1.0):
    """模拟钢琴音：基频 + 2次/3次泛音，指数衰减，快速起音"""
    n = int(duration * sample_rate)
    if n <= 0:
        return []
    out = []
    attack = int(0.005 * sample_rate)
    for i in range(n):
        t = i / sample_rate
        # 指数衰减
        env = math.exp(-t * (2.5 + freq / 1800.0))
        # 快速起音
        if i < attack:
            env *= i / attack
        s = (math.sin(2 * math.pi * freq * t) +
             0.35 * math.sin(2 * math.pi * freq * 2 * t) +
             0.12 * math.sin(2 * math.pi * freq * 3 * t) +
             0.06 * math.sin(2 * math.pi * freq * 4 * t))
        out.append(s * env * vel)
    return out

def mix_into(buf, start, tones):
    """把音色列表叠加进浮点数组 buf（从 start 采样点开始）"""
    for i, v in enumerate(tones):
        idx = start + i
        if idx < len(buf):
            buf[idx] += v

def add_note(buf, midi_note, start_sec, dur_sec, vel=1.0):
    mix_into(buf, int(start_sec * SAMPLE_RATE),
             piano_tone(note_freq(midi_note), dur_sec, vel=vel))

def render(song):
    total = int(song['length'] * SAMPLE_RATE)
    buf = [0.0] * total
    for ev in song['events']:
        add_note(buf, ev[0], ev[1], ev[2], ev[3] if len(ev) > 3 else 1.0)
    # 软限幅 + 归一化
    peak = max(1e-9, max(abs(v) for v in buf))
    scale = min(1.0, 0.92 / peak)
    # 淡入淡出
    fade_in = int(0.4 * SAMPLE_RATE)
    fade_out = int(1.0 * SAMPLE_RATE)
    n = len(buf)
    for i in range(n):
        v = buf[i] * scale
        if i < fade_in:
            v *= i / fade_in
        if i > n - fade_out:
            v *= (n - i) / fade_out
        buf[i] = v
    return buf

def write_mp3(samples, path):
    pcm = []
    for v in samples:
        sv = int(max(-1.0, min(1.0, v)) * 32767)
        pcm.append(sv)
    data = b''.join(sv.to_bytes(2, 'little', signed=True) for sv in pcm)
    enc = lameenc.Encoder()
    enc.set_bit_rate(192)
    enc.set_in_sample_rate(SAMPLE_RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(data) + enc.flush()
    with open(path, 'wb') as f:
        f.write(mp3)
    print('written:', path, os.path.getsize(path), 'bytes')

def build_events(notes, tempo_bpm, rhythm=0.5, vel=1.0, key='C', chord='maj'):
    """把 (midi, 拍数) 序列铺成带和弦伴奏的钢琴曲事件"""
    beat = 60.0 / tempo_bpm
    events = []
    t = 0.0
    for mid, beats in notes:
        dur = beats * beat
        events.append((mid, t, dur * 0.95, vel))
        # 简单左手伴奏：和弦根音 + 五音，低八度
        root_midi = mid - 24
        # 每拍或每两拍垫一个低音
        events.append((root_midi - 12, t, dur * 0.6, vel * 0.5))
        events.append((root_midi - 5, t + dur * 0.5, dur * 0.4, vel * 0.35))
        t += dur
    return events

def extend_events(events, total_sec):
    """把一段旋律事件循环扩展到指定时长（不重叠在淡出区）"""
    if not events:
        return events
    loop_len = max(ev[1] + ev[2] for ev in events) + 0.5  # 一段的长度
    out = list(events)
    t = loop_len
    # 用同样的事件但逐渐轻微降速/降响度模拟变奏（简单的二次重复）
    while t < total_sec - 3.0:  # 留 3 秒淡出
        for ev in events:
            # 第二次重复力度略轻，第三次略加重，制造层次
            rep = int(round(t / loop_len))
            vel = ev[3]
            if rep % 2 == 1:
                vel *= 0.9
            out.append((ev[0], t + ev[1], ev[2], vel))
        t += loop_len
    return out

# ---------------- 原创曲目（每首约 2 分钟） ----------------

# 三首曲子的基础旋律（一段约 20-30 秒）
MELODIES = {
    'Tender Confession.mp3': [
        (midi('E', 5), 2), (midi('G', 5), 2), (midi('A', 5), 2),
        (midi('G', 5), 2), (midi('E', 5), 3), (midi('D', 5), 1),
        (midi('C', 5), 4), (midi('E', 5), 2), (midi('G', 5), 2),
        (midi('A', 5), 2), (midi('C', 6), 2), (midi('B', 5), 3), (midi('G', 5), 1),
        (midi('E', 5), 2), (midi('D', 5), 2), (midi('C', 5), 4),
    ],
    'Starlit Promise.mp3': [
        (midi('G', 4), 1), (midi('D', 5), 1), (midi('B', 4), 2),
        (midi('D', 5), 1), (midi('G', 5), 1), (midi('F#', 5), 2),
        (midi('E', 5), 1), (midi('D', 5), 1), (midi('C', 5), 2),
        (midi('D', 5), 2), (midi('B', 4), 2), (midi('G', 4), 4),
        (midi('A', 4), 1), (midi('B', 4), 1), (midi('C', 5), 2),
        (midi('D', 5), 2), (midi('E', 5), 2), (midi('F#', 5), 2),
        (midi('D', 5), 4),
    ],
    'Eternal Vow.mp3': [
        (midi('A', 4), 3), (midi('C', 5), 1), (midi('F', 5), 4),
        (midi('E', 5), 3), (midi('D', 5), 1), (midi('C', 5), 4),
        (midi('D', 5), 2), (midi('E', 5), 2), (midi('F', 5), 4),
        (midi('A', 5), 3), (midi('G', 5), 1), (midi('F', 5), 4),
        (midi('E', 5), 2), (midi('C', 5), 2), (midi('D', 5), 4),
    ],
}

# 每首目标时长（秒）
TARGET_SEC = {
    'Tender Confession.mp3': 120,
    'Starlit Promise.mp3': 115,
    'Eternal Vow.mp3': 125,
}

# 每首速度
TEMPOS = {
    'Tender Confession.mp3': 72,
    'Starlit Promise.mp3': 88,
    'Eternal Vow.mp3': 66,
}

SONGS = {}
for fname, notes in MELODIES.items():
    events = build_events(notes, tempo_bpm=TEMPOS[fname], vel=0.95)
    events = extend_events(events, TARGET_SEC[fname])
    SONGS[fname] = {
        'length': TARGET_SEC[fname],
        'events': events,
    }

def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    for fname, song in SONGS.items():
        samples = render(song)
        write_mp3(samples, os.path.join(AUDIO_DIR, fname))

if __name__ == '__main__':
    main()
