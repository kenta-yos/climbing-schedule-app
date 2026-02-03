import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date

st.set_page_config(page_title="セット管理Pro Next", layout="centered")

# --- スコア設定 ---
SCORE_NEW_SET = 50
SCORE_LONG_ABSENCE = 30
SCORE_FRIENDS = 10

# --- データ取得 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    gyms = conn.read(worksheet="gym_master")
    schedules = conn.read(worksheet="schedules")
    logs = conn.read(worksheet="climbing_logs")
    return gyms, schedules, logs

# データ読み込み
gym_df, schedule_df, log_df = load_data()

# 型変換（エラー防止）
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# スコア計算（ロジックは維持）
def calculate_gym_scores(gym_df, schedule_df, log_df):
    today = datetime.now()
    scores = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []
        
        # セット情報
        gym_sched = schedule_df[schedule_df['gym_name'] == name]
        if not gym_sched.empty:
            latest_set = gym_sched['start_date'].max()
            days_since = (today - latest_set).days
            if days_since <= 7:
                score += SCORE_NEW_SET
                reasons.append(f"🔥 新セット({days_since}日前)")
            elif days_since <= 14:
                score += (SCORE_NEW_SET // 2)
                reasons.append("✨ 準新セット")

        # 履歴
        my_logs = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '実績')]
        if not my_logs.empty:
            last_v = my_logs['date'].max()
            days_v = (today - last_v).days
            if days_v >= 30:
                score += SCORE_LONG_ABSENCE
                reasons.append(f":hourglass: {days_v}日ぶり")
        else:
            score += SCORE_LONG_ABSENCE
            reasons.append(":new: 初訪問")

        # 仲間
        friends = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '予定') & (log_df['date'].dt.date == date.today())]
        if not friends.empty:
            score += (SCORE_FRIENDS * len(friends))
            reasons.append(f":busts_in_silhouette: 仲間{len(friends)}人")

        scores.append({"gym_name": name, "total_score": score, "reasons": reasons, "area": gym.get('area_tag', ''), "url": gym.get('profile_url', '')})
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# --- メイン画面構成 ---
# 画面上部にタブを配置。これがメニュー代わりになります。
tab1, tab2, tab3 = st.tabs([":house: Today", ":memo: 記録/予定", ":gear: 管理"])

# ==========================================
# Tab 1: Todayビュー（今日の提案）
# ==========================================
with tab1:
    st.markdown("### :dart: 今日のおすすめ")
    ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df)

    for gym in ranked_gyms:
        with st.container():
            is_hot = gym['total_score'] >= 50
            st.markdown(f"""
                <div style="border-left: 5px solid {'#FF512F' if is_hot else '#CCC'}; background: white; padding: 15px; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 800; font-size: 1.1rem;">{gym['gym_name']}</span>
                        <span style="font-size: 0.8rem; color: #888;">{gym['area']}</span>
                    </div>
                    <div style="margin: 8px 0;">
                        {' '.join([f'<span style="background: #FFF0F0; color: #FF512F; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; margin-right: 4px; border: 1px solid #FFE0E0;">{r}</span>' for r in gym['reasons']])}
                    </div>
                </div>
            """, unsafe_allow_html=True)
            
            # 1タップアクションボタンの配置イメージ
            c1, c2, c3 = st.columns(3)
            with c1: st.button(":hand: 行く", key=f"pre_{gym['gym_name']}")
            with c2: st.button(":white_check_mark: 登った", key=f"log_{gym['gym_name']}")
            with c3: st.link_button(":camera_with_flash: Insta", gym['url'] if gym['url'] else "https://instagram.com")

# ==========================================
# Tab 2: 予定・ログ登録
# ==========================================
with tab2:
    st.markdown("### :memo: スケジュール登録")
    st.info("ここに「後日登録」や「詳細な予定入力」を配置します。")

# ==========================================
# Tab 3: 管理（マスター登録）
# ==========================================
with tab3:
    st.markdown("### :gear: マスタ管理")
    st.info("ここにジム登録やセットスケジュール登録（既存機能）を配置します。")
