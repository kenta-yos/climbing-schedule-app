import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date

st.set_page_config(page_title="セット管理Pro Next v1", layout="centered")

# ---------------------
# 設定スコア
# ---------------------
SCORE_NEW_SET = 50
SCORE_LONG_ABSENCE = 30
SCORE_FRIENDS = 10

# ---------------------
# GSheets接続
# ---------------------
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    gyms = conn.read(worksheet="gym_master")
    schedules = conn.read(worksheet="schedules")
    logs = conn.read(worksheet="climbing_logs")
    plans = conn.read(worksheet="plans")
    return gyms, schedules, logs, plans

gym_df, schedule_df, log_df, plans_df = load_data()

# 型変換
schedule_df['start_date'] = pd.to_datetime(schedule_df['start_date'])
log_df['date'] = pd.to_datetime(log_df['date'])
plans_df['date'] = pd.to_datetime(plans_df['date'])

# ---------------------
# ユーザー選択
# ---------------------
if 'user_name' not in st.session_state:
    st.session_state.user_name = st.text_input("名前を入力（必須）")
    if not st.session_state.user_name:
        st.warning("名前を入力してください")
        st.stop()
user_name = st.session_state.user_name

# ---------------------
# スコア計算
# ---------------------
def calculate_gym_scores(gym_df, schedule_df, log_df, plans_df):
    today = datetime.now()
    scores = []
    for _, gym in gym_df.iterrows():
        name = gym['gym_name']
        score = 0
        reasons = []

        # ① 新セット情報
        gym_sched = schedule_df[schedule_df['gym_name'] == name]
        if not gym_sched.empty:
            latest_set = gym_sched['start_date'].max()
            days_since = (today - latest_set).days
            if days_since <= 7:
                score += SCORE_NEW_SET
                reasons.append(f"🔥 新セット({days_since}日前)")
            elif days_since <= 14:
                score += SCORE_NEW_SET // 2
                reasons.append("✨ 準新セット")

        # ② 長期未訪問
        my_logs = log_df[(log_df['gym_name'] == name) & (log_df['user_name'] == user_name)]
        if not my_logs.empty:
            last_v = my_logs['date'].max()
            days_v = (today - last_v).days
            if days_v >= 30:
                score += SCORE_LONG_ABSENCE
                reasons.append(f":hourglass: {days_v}日ぶり")
        else:
            score += SCORE_LONG_ABSENCE
            reasons.append(":new: 初訪問")

        # ④ 仲間情報
        friends = plans_df[(plans_df['gym_name'] == name) & (plans_df['date'].dt.date == date.today()) & (plans_df['user_name'] != user_name)]
        if not friends.empty:
            score += SCORE_FRIENDS * len(friends)
            reasons.append(f":busts_in_silhouette: 仲間{len(friends)}人")

        scores.append({
            "gym_name": name,
            "total_score": score,
            "reasons": reasons,
            "area": gym.get('area_tag', ''),
            "url": gym.get('profile_url', '')
        })
    return sorted(scores, key=lambda x: x['total_score'], reverse=True)

# ---------------------
# タブ構成
# ---------------------
tab1, tab2, tab3 = st.tabs([":house: Today", ":memo: 記録/予定", ":gear: 管理"])

# =====================
# Tab1: Today
# =====================
with tab1:
    st.markdown("### :dart: 今日のおすすめ")
    ranked_gyms = calculate_gym_scores(gym_df, schedule_df, log_df, plans_df)
    top_gyms = [g for g in ranked_gyms if g['total_score'] > 0][:5]

    for gym in top_gyms:
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

            c1, c2, c3 = st.columns(3)
            with c1:
                if st.button("🤚 行く", key=f"plan_{gym['gym_name']}"):
                    new_row = pd.DataFrame([{"date": date.today().isoformat(), "gym_name": gym['gym_name'], "user_name": user_name}])
                    conn.update(worksheet="plans", data=pd.concat([plans_df, new_row], ignore_index=True))
                    st.experimental_rerun()
            with c2:
                if st.button("✅ 登った", key=f"log_{gym['gym_name']}"):
                    new_row = pd.DataFrame([{"date": date.today().isoformat(), "gym_name": gym['gym_name'], "user_name": user_name}])
                    conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new_row], ignore_index=True))
                    st.experimental_rerun()
            with c3:
                st.link_button("📷 Insta", gym['url'] if gym['url'] else "https://instagram.com")

# =====================
# Tab2: 記録/予定
# =====================
with tab2:
    st.markdown("### :memo: 今日の予定/実績")
    # 今日の予定
    today_plans = plans_df[plans_df['date'].dt.date == date.today()]
    today_logs = log_df[log_df['date'].dt.date == date.today()]

    for df, type_name, sheet in [(today_plans, "予定", "plans"), (today_logs, "実績", "climbing_logs")]:
        st.markdown(f"#### {type_name}")
        for idx, row in df.iterrows():
            c1, c2 = st.columns([3,1])
            c1.write(f"{row['gym_name']} ({row['user_name']})")
            if c2.button("削除", key=f"del_{type_name}_{idx}"):
                new_df = df.drop(idx)
                conn.update(worksheet=sheet, data=new_df)
                st.experimental_rerun()

    st.markdown("### 手動追加")
    with st.form("manual_add"):
        add_date = st.date_input("日付", value=date.today())
        add_gym = st.selectbox("ジム", options=gym_df['gym_name'].tolist())
        add_type = st.radio("種別", options=["予定", "実績"])
        if st.form_submit_button("保存"):
            new_row = pd.DataFrame([{"date": add_date.isoformat(), "gym_name": add_gym, "user_name": user_name}])
            sheet = "plans" if add_type=="予定" else "climbing_logs"
            df_to_update = plans_df if add_type=="予定" else log_df
            conn.update(worksheet=sheet, data=pd.concat([df_to_update, new_row], ignore_index=True))
            st.experimental_rerun()

# =====================
# Tab3: 管理
# =====================
with tab3:
    st.markdown("### :gear: ジム管理")
    with st.form("gym_add_form"):
        n = st.text_input("ジム名")
        a = st.text_input("エリア")
        u = st.text_input("Instagram URL")
        if st.form_submit_button("登録"):
            if n:
                new_row = pd.DataFrame([{"gym_name": n, "area_tag": a, "profile_url": u}])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new_row], ignore_index=True))
                st.experimental_rerun()

    st.markdown("### セットスケジュール管理")
    with st.form("schedule_add_form"):
        sel_gym = st.selectbox("ジム", options=gym_df['gym_name'].tolist())
        s_date = st.date_input("開始日")
        e_date = st.date_input("終了日", value=s_date)
        p_url = st.text_input("Instagram URL (任意)")
        if st.form_submit_button("登録"):
            new_row = pd.DataFrame([{"gym_name": sel_gym, "start_date": s_date.isoformat(),
                                     "end_date": e_date.isoformat(), "post_url": p_url}])
            conn.update(worksheet="schedules", data=pd.concat([schedule_df, new_row], ignore_index=True))
            st.experimental_rerun()

    st.markdown("### 登録済みジム一覧")
    for _, row in gym_df.iterrows():
        last_visit = log_df[log_df['gym_name']==row['gym_name']].date.max()
        last_visit_str = last_visit.strftime("%Y/%m/%d") if pd.notna(last_visit) else "-"
        st.write(f"{row['gym_name']} ({row.get('area_tag','')}) - Last: {last_visit_str}")

