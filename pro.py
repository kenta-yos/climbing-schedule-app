import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px

# --- 1. ページ設定 & CSS ---
st.set_page_config(page_title="Go Bouldering", layout="centered")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .gym-title { font-size: 1.1rem; font-weight: 700; color: #1A1A1A !important; text-decoration: none !important; }
    .gym-link { color: #007bff !important; text-decoration: none !important; font-weight: 600; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; font-weight: 500; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
    .item-box { display: grid; grid-template-columns: 4px 60px 30px 1fr; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #F8F8F8; text-decoration: none !important; }
    .item-accent { width: 4px; height: 1.2rem; border-radius: 2px; background: #B22222; }
    .item-date { font-size: 0.8rem; font-weight: 700; color: #B22222; }
    .item-icon { font-size: 1rem; text-align: center; }
    .item-text { font-size: 0.9rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .past-opacity { opacity: 0.35; }
    .insta-card { background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
    .insta-val { font-size: 2rem; font-weight: 800; }
    </style>
""", unsafe_allow_html=True)

# --- 2. データ接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    try:
        gyms = conn.read(worksheet="gym_master", ttl=1).dropna(how='all')
        sched = conn.read(worksheet="schedules", ttl=1).dropna(how='all')
        logs = conn.read(worksheet="climbing_logs", ttl=1).dropna(how='all')
        users = conn.read(worksheet="users", ttl=1).dropna(how='all')
        for df in [gyms, sched, logs, users]:
            df.columns = [str(c).strip().lower() for c in df.columns]
        if not sched.empty: sched['start_date'] = pd.to_datetime(sched['start_date'], errors='coerce')
        if not logs.empty: logs['date'] = pd.to_datetime(logs['date'], errors='coerce')
        return gyms, sched, logs, users
    except:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

gym_df, sched_df, log_df, user_df = load_data()

# --- 3. 認証 ---
saved_user = st.query_params.get("user")
if 'USER' not in st.session_state:
    if saved_user and not user_df.empty:
        u_match = user_df[user_df['user'] == saved_user]
        if not u_match.empty:
            row = u_match.iloc[0]
            st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = row['user'], row['color'], row['icon']
    else: st.session_state.USER = None

if not st.session_state.USER:
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                st.markdown(f"<style>div.stButton > button[key='l_{row['user']}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=f"l_{row['user']}"):
                    st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = row['user'], row['color'], row['icon']
                    st.query_params["user"] = row['user']; st.rerun()
    st.stop()

# --- 4. 共通保存ロジック（日付を文字列に固定） ---
def safe_save(worksheet_name, df):
    # 日付カラムが存在する場合、すべて文字列に変換してスプシの型壊れを防ぐ
    for col in ['date', 'start_date', 'end_date']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col]).dt.strftime('%Y-%m-%d')
    conn.update(worksheet=worksheet_name, data=df)
    st.cache_data.clear(); st.rerun()

# --- 5. タブ ---
tabs = st.tabs(["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"])

# Tab 1: Top
with tabs[0]:
    st.subheader("🚀 クイック登録")
    with st.form("quick_log"):
        q_date = st.date_input("日程", value=date.today())
        q_gym = st.selectbox("ジムを選択", gym_df['gym_name'].tolist()) if not gym_df.empty else st.text_input("ジム名")
        c1, c2 = st.columns(2)
        if c1.form_submit_button("✋ 予定"):
            new = pd.DataFrame([[q_date, q_gym, st.session_state.USER, '予定']], columns=['date','gym_name','user','type'])
            safe_save("climbing_logs", pd.concat([log_df, new], ignore_index=True))
        if c2.form_submit_button("✅ 実績"):
            new = pd.DataFrame([[q_date, q_gym, st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
            safe_save("climbing_logs", pd.concat([log_df, new], ignore_index=True))

# Tab 2: ジム (おすすめ)
with tabs[1]:
    st.subheader("🎯 おすすめ")
    target_date = st.date_input("ターゲット日", value=date.today(), key="tg_gym")
    sel_area = st.selectbox("エリア絞り込み", ["すべて"] + sorted(gym_df['area_tag'].unique().tolist()) if not gym_df.empty else ["すべて"])
    
    res = []
    for _, gym in gym_df.iterrows():
        if sel_area != "すべて" and gym['area_tag'] != sel_area: continue
        name, score, reasons = gym['gym_name'], 0, []
        if not sched_df.empty:
            g_s = sched_df[sched_df['gym_name'] == name]['start_date'].dropna()
            if not g_s.empty:
                diff = (pd.to_datetime(target_date) - g_s.max()).days
                if 0 <= diff <= 7: score += 50; reasons.append(f"🔥 新セット({diff}日前)")
        others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == pd.to_datetime(target_date))]
        if not others.empty: score += (15 * len(others)); reasons.append(f"👥 {len(others)}名の予定")
        res.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
    
    for gym in sorted(res, key=lambda x: x['score'], reverse=True)[:3]:
        tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
        st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" class="gym-title">{gym["name"]}</a> <div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)
        c1, c2, c3 = st.columns(3)
        if c1.button("✋ 予定", key=f"p_{gym['name']}"):
            new = pd.DataFrame([[target_date, gym['name'], st.session_state.USER, '予定']], columns=['date','gym_name','user','type'])
            safe_save("climbing_logs", pd.concat([log_df, new], ignore_index=True))
        if c2.button("✅ 実績", key=f"r_{gym['name']}"):
            new = pd.DataFrame([[target_date, gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
            safe_save("climbing_logs", pd.concat([log_df, new], ignore_index=True))
        p_match = log_df[(log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定')]
        if not p_match.empty and c3.button("🔄 変換", key=f"c_{gym['name']}"):
            save_df = log_df.drop(p_match.index)
            new = pd.DataFrame([[target_date, gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
            safe_save("climbing_logs", pd.concat([save_df, new], ignore_index=True))

# Tab 3: マイページ
with tabs[2]:
    st.subheader("🗓️ 登る予定")
    my_plans = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'].dt.date >= date.today())].sort_values('date')
    for _, row in my_plans.iterrows():
        st.markdown(f'<div class="item-box"><div class="item-accent" style="background:#FFD700"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">✋</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
    
    st.markdown("---")
    st.subheader("📊 統計")
    c1, c2 = st.columns(2)
    ms = c1.date_input("開始", value=date.today().replace(day=1), key="ms")
    me = c2.date_input("終了", value=date.today(), key="me")
    my_period_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['date'].dt.date >= ms) & (log_df['date'].dt.date <= me)].sort_values('date', ascending=False)
    my_period_res = my_period_logs[my_period_logs['type'] == '実績']
    
    if not my_period_res.empty:
        counts = my_period_res['gym_name'].value_counts().reset_index()
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', color_discrete_sequence=['#DD2476'])
        fig.update_layout(height=200, margin=dict(t=0,b=0,l=100,r=40), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("📝 履歴")
    for i, row in my_period_logs.iterrows():
        cc1, cc2 = st.columns([5, 1])
        cc1.markdown(f'<div class="item-box"><div class="item-accent" style="background:{"#B22222" if row["type"]=="実績" else "#FFD700"}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{"✅" if row["type"]=="実績" else "✋"}</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
        if cc2.button("🗑️", key=f"del_{i}"): safe_save("climbing_logs", log_df.drop(i))

# Tab 4: 仲間
with tabs[3]:
    st.subheader("👥 仲間の予定")
    valid_logs = log_df.dropna(subset=['date'])
    others = valid_logs[(valid_logs['user'] != st.session_state.USER) & (valid_logs['type'] == '予定') & (valid_logs['date'].dt.date >= date.today())].sort_values('date')
    for _, row in others.iterrows():
        u_info = user_df[user_df['user'] == row['user']].iloc[0] if row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
        st.markdown(f'<div class="item-box"><div class="item-accent" style="background:{u_info["color"]}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{u_info["icon"]}</div><div class="item-text"><b>{row["user"]}</b> @ {row["gym_name"]}</div></div>', unsafe_allow_html=True)

# Tab 5: セット
with tabs[4]:
    st.subheader("📅 セット")
    for _, row in sched_df.sort_values('start_date', ascending=True).iterrows():
        if pd.isna(row['start_date']): continue
        is_past = row['start_date'].date() < date.today()
        st.markdown(f'<a href="{row.get("post_url","#")}" target="_blank" class="item-box {"past-opacity" if is_past else ""}"><div class="item-accent" style="background:#B22222"></div><div class="item-date">{row["start_date"].strftime("%m/%d")}</div><div class="item-icon">🗓️</div><div class="item-text">{row["gym_name"]}</div></a>', unsafe_allow_html=True)

# Tab 6: 管理 (完全復活版)
with tabs[5]:
    st.subheader("⚙️ 管理機能")
    with st.expander("🆕 ジムの新規登録"):
        with st.form("admin_gym"):
            n = st.text_input("ジム名")
            u = st.text_input("Instagram URL")
            a = st.text_input("エリアタグ")
            if st.form_submit_button("登録"):
                new_gym = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                safe_save("gym_master", pd.concat([gym_df, new_gym], ignore_index=True))

    with st.expander("📅 セットスケジュール登録"):
        sel_gym = st.selectbox("対象ジム", gym_df['gym_name'].tolist()) if not gym_df.empty else ""
        p_url = st.text_input("告知URL")
        if "rows" not in st.session_state: st.session_state.rows = 1
        dates = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            sd = c1.date_input(f"開始 {i+1}", key=f"sd_{i}")
            ed = c2.date_input(f"終了 {i+1}", key=f"ed_{i}")
            dates.append((sd, ed))
        if st.button("➕ 日程を追加"):
            st.session_state.rows += 1; st.rerun()
        if st.button("🚀 この内容で一括登録"):
            new_s = pd.DataFrame([[sel_gym, d[0], d[1], p_url] for d in dates], columns=['gym_name','start_date','end_date','post_url'])
            st.session_state.rows = 1
            safe_save("schedules", pd.concat([sched_df, new_s], ignore_index=True))

    st.divider()
    if st.button("🚪 ログアウト"):
        st.session_state.USER = None; st.query_params.clear(); st.rerun()
