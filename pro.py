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
    # ttl=0 で常に最新を取得（ボタン押下後の反映のため）
    gyms = conn.read(worksheet="gym_master", ttl=0)
    schedules = conn.read(worksheet="schedules", ttl=0)
    logs = conn.read(worksheet="climbing_logs", ttl=0)

    # 列名の空白削除
    gyms.columns = gyms.columns.str.strip()
    schedules.columns = schedules.columns.str.strip()
    logs.columns = logs.columns.str.strip()

    return gyms, schedules, logs

gym_df, schedule_df, log_df = load_data()

# 日付型変換
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])

# --- ユーザー管理（簡易ログイン） ---
if 'USER' not in st.session_state:
    st.session_state.USER = ""

if not st.session_state.USER:
    USER = st.text_input("あなたの名前を入力してください（例：ケンジ）")
    if USER:
        st.session_state.USER = USER
        st.rerun()
    st.stop()

USER = st.session_state.USER
st.sidebar.write(f"Login: {USER}")
if st.sidebar.button("ログアウト"):
    st.session_state.USER = ""
    st.rerun()

# --- スコア計算ロジック ---
def calculate_gym_scores(gym_df, schedule_df, log_df, user):
    today = datetime.now()
    scores = []
    
    # スプシのカラム名が 'user' か 'user_name' か確認（今回は user と想定）
    user_col = 'user' if 'user' in log_df.columns else 'user_name'

    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []

        # 1. セット情報
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

        # 2. 自分の履歴（実績のみ）
        my_logs = log_df[(log_df['gym_name'] == name) & (log_df['type'] == '実績') & (log_df[user_col] == user)]
        if not my_logs.empty:
            last_v = my_logs['date'].max()
            days_v = (today - last_v).days
            if days_v >= 30:
                score += SCORE_LONG_ABSENCE
                reasons.append(f"⌛ {days_v}日ぶり")
        else:
            score += SCORE_LONG_ABSENCE
            reasons.append("🆕 初訪問")

        # 3. 仲間の予定（自分以外が今日行く予定）
        friends = log_df[(log_df['gym_name'] == name) & 
                         (log_df['type'] == '予定') & 
                         (log_df['date'].dt.date == date.today()) &
                         (log_df[user_col] != user)]
        if not friends.empty:
            score += (SCORE_FRIENDS * len(friends))
            names = ", ".join(friends[user_col].unique())
            reasons.append(f"👥 仲間({names})が予定中")

        scores.append({
            "gym_name": name,
            "total_score": score,
            "reasons": reasons,
            "area": gym.get('area_tag', ''),
            "url": gym.get('profile_url', '')
        })
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# --- タブ構成 ---
tab1, tab2, tab3 = st.tabs([":dart: Today", ":memo: 予定/実績ログ", ":gear: 管理"])

# ==========================================
# Tab 1: Todayビュー（今日の提案）
# ==========================================
with tab1:
    st.markdown(f"### 🎯 {USER}さんへのおすすめ")
    ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df, USER)
    
    for gym in ranked_gyms:
        with st.container():
            st.markdown(f"""
                <div style="border-left: 5px solid {'#FF512F' if gym['total_score'] >= 50 else '#CCC'}; background: white; padding: 15px; border-radius: 8px; margin-bottom: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 800; font-size: 1.1rem; color: #333;">{gym['gym_name']}</span>
                        <span style="font-size: 0.8rem; color: #888;">{gym['area']}</span>
                    </div>
                    <div style="margin: 8px 0;">
                        {' '.join([f'<span style="background: #FFF0F0; color: #FF512F; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; margin-right: 4px; border: 1px solid #FFE0E0;">{r}</span>' for r in gym['reasons']])}
                    </div>
                </div>
            """, unsafe_allow_html=True)
            
            c1, c2, c3 = st.columns(3)
            with c1:
                if st.button(f"✋ 行く", key=f"plan_{gym['gym_name']}"):
                    new_log = pd.DataFrame([[date.today().isoformat(), gym['gym_name'], USER, '予定']], 
                                          columns=['date', 'gym_name', 'user', 'type'])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_log], ignore_index=True))
                    st.success("予定を登録しました！")
                    st.rerun()
            with c2:
                if st.button(f"✅ 登った", key=f"log_{gym['gym_name']}"):
                    new_log = pd.DataFrame([[date.today().isoformat(), gym['gym_name'], USER, '実績']], 
                                          columns=['date', 'gym_name', 'user', 'type'])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_log], ignore_index=True))
                    st.success("実績を保存しました！")
                    st.rerun()
            with c3:
                st.link_button("📸 Insta", gym['url'] if gym['url'] else "https://instagram.com")

# ==========================================
# Tab 2: ログ確認
# ==========================================
with tab2:
    st.markdown("### ログ・予定一覧")
    st.dataframe(log_df.sort_values('date', ascending=False), use_container_width=True)

# ==========================================
# Tab 3: 管理（マスタ登録）
# ==========================================
with tab3:
    st.markdown("### ジムの新規登録")
    with st.form("gym_form"):
        name = st.text_input("ジム名")
        area = st.text_input("エリア（例：秋葉原）")
        url = st.text_input("Instagram URL")
        if st.form_submit_button("ジムを追加"):
            if name:
                new_gym = pd.DataFrame([[name, url, area]], columns=['gym_name', 'profile_url', 'area_tag'])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new_gym], ignore_index=True))
                st.success(f"{name} を登録しました")
                st.rerun()

    st.markdown("---")
    st.markdown("### セットスケジュールの登録")
    with st.form("set_form"):
        gym_name = st.selectbox("ジムを選択", gym_df['gym_name'].tolist())
        start_d = st.date_input("セット開始日")
        end_d = st.date_input("セット終了日", value=start_d)
        inst_url = st.text_input("告知URL")
        if st.form_submit_button("セット情報を登録"):
            new_set = pd.DataFrame([[gym_name, start_d.isoformat(), end_d.isoformat(), inst_url]], 
                                   columns=['gym_name', 'start_date', 'end_date', 'post_url'])
            conn.update(worksheet="schedules", data=pd.concat([schedule_df, new_set], ignore_index=True))
            st.success(f"{gym_name} のセット情報を登録しました")
            st.rerun()
