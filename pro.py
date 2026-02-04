import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px

# --- 1. ページ設定 & CSS定義 ---
st.set_page_config(page_title="Go Bouldering", layout="centered")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
    
    /* カード・タグ */
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .gym-title { font-size: 1.1rem; font-weight: 700; color: #1A1A1A !important; text-decoration: none !important; }
    .gym-link { color: #007bff !important; text-decoration: none !important; font-weight: 600; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; font-weight: 500; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }

    /* Gridリスト構造（仕様書準拠） */
    .item-box { display: grid; grid-template-columns: 4px 60px 30px 1fr; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #F8F8F8; text-decoration: none !important; }
    .item-accent { width: 4px; height: 1.2rem; border-radius: 2px; background: #B22222; }
    .item-date { font-size: 0.8rem; font-weight: 700; color: #B22222; }
    .item-icon { font-size: 1rem; text-align: center; }
    .item-text { font-size: 0.9rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .past-opacity { opacity: 0.35; }

    /* 分析カード */
    .insta-card { background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
    .insta-val { font-size: 2rem; font-weight: 800; }
    </style>
""", unsafe_allow_html=True)

# --- 2. データ接続 & 読み込み ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    try:
        # API制限対策：ttlを1秒に設定
        gyms = conn.read(worksheet="gym_master", ttl=1).dropna(how='all')
        sched = conn.read(worksheet="schedules", ttl=1).dropna(how='all')
        logs = conn.read(worksheet="climbing_logs", ttl=1).dropna(how='all')
        users = conn.read(worksheet="users", ttl=1).dropna(how='all')
        
        for df in [gyms, sched, logs, users]:
            df.columns = [str(c).strip().lower() for c in df.columns]
        
        if not sched.empty: 
            sched['start_date'] = pd.to_datetime(sched['start_date'], errors='coerce')
        if not logs.empty: 
            logs['date'] = pd.to_datetime(logs['date'], errors='coerce')
            
        return gyms, sched, logs, users
    except Exception as e:
        st.warning("Google Sheets 接続待機中、またはデータ読み込みエラー。")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

gym_df, sched_df, log_df, user_df = load_data()

# --- 3. セッション & 自動ログインロジック ---
saved_user = st.query_params.get("user")

if 'USER' not in st.session_state:
    if saved_user and not user_df.empty:
        u_match = user_df[user_df['user'] == saved_user]
        if not u_match.empty:
            row = u_match.iloc[0]
            st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = row['user'], row['color'], row['icon']
    else:
        st.session_state.USER = None

# ログイン画面
if not st.session_state.USER:
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                st.markdown(f"<style>div.stButton > button[key='l_{row['user']}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=f"l_{row['user']}"):
                    st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = row['user'], row['color'], row['icon']
                    st.query_params["user"] = row['user']
                    st.rerun()
    st.stop()

# --- 4. タブ構成 ---
tabs = st.tabs(["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"])

# ==========================================
# Tab 1: 🏠 Top (クイック登録)
# ==========================================
with tabs[0]:
    st.subheader("🚀 クイック登録")
    with st.form("quick_log"):
        q_date = st.date_input("日程", value=date.today())
        q_gym = st.selectbox("ジムを選択", gym_df['gym_name'].tolist()) if not gym_df.empty else st.text_input("ジム名")
        c1, c2 = st.columns(2)
        submit_plan = c1.form_submit_button("✋ 登るぜ (予定)")
        submit_done = c2.form_submit_button("✅ 登ったよ (実績)")
        
        if submit_plan or submit_done:
            t_type = "予定" if submit_plan else "実績"
            new = pd.DataFrame([[q_date.isoformat(), q_gym, st.session_state.USER, t_type]], columns=['date','gym_name','user','type'])
            conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True))
            st.cache_data.clear(); st.success(f"{q_gym} に{t_type}を登録しました！"); st.rerun()

# ==========================================
# Tab 2: ✨ ジム (おすすめ & 一覧)
# ==========================================
with tabs[1]:
    st.subheader("🎯 おすすめ & 検索")
    target_date = st.date_input("ターゲット日", value=date.today(), key="target_gym")
    areas = ["すべて"] + sorted(gym_df['area_tag'].unique().tolist()) if not gym_df.empty else ["すべて"]
    sel_area = st.selectbox("エリア絞り込み", areas)

    def get_ranked_gyms(t_date):
        t_dt = pd.to_datetime(t_date)
        res = []
        for _, gym in gym_df.iterrows():
            if sel_area != "すべて" and gym['area_tag'] != sel_area: continue
            name, score, reasons = gym['gym_name'], 0, []
            
            # スコアリング: 新セット
            if not sched_df.empty:
                g_s = sched_df[sched_df['gym_name'] == name]['start_date'].dropna()
                if not g_s.empty:
                    diff = (t_dt - g_s.max()).days
                    if 0 <= diff <= 7: score += 50; reasons.append(f"🔥 新セット({diff}日前)")
                    elif 0 <= diff <= 14: score += 25; reasons.append("✨ 準新セット")
            
            # スコアリング: 訪問履歴
            my_v = log_df[(log_df['gym_name'] == name) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
            if my_v.empty: score += 30; reasons.append("🆕 未訪問")
            else:
                v_diff = (t_dt - my_v['date'].max()).days
                if v_diff >= 30: score += 30; reasons.append(f"⌛ {v_diff}日ぶり")
            
            # スコアリング: 仲間
            others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == t_dt)]
            if not others.empty:
                score += (15 * len(others)); reasons.append(f"👥 {len(others)}名の予定")
            
            res.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
        return sorted(res, key=lambda x: x['score'], reverse=True)

    ranked = get_ranked_gyms(target_date)
    for gym in ranked[:3]:
        with st.container():
            tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
            st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" class="gym-title">{gym["name"]}</a> <small>({gym["area"]})</small><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)
            cc1, cc2, cc3 = st.columns(3)
            if cc1.button("✋ 予定", key=f"p_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            if cc2.button("✅ 実績", key=f"r_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            
            has_p = not log_df[(log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定')].empty
            if has_p and cc3.button("🔄 変換", key=f"c_{gym['name']}"):
                base = log_df[~((log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定'))]
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([base, new], ignore_index=True)); st.cache_data.clear(); st.rerun()

    st.divider()
    g_tab1, g_tab2 = st.tabs(["🏢 訪問済", "🗺️ 未訪問"])
    my_done_gyms = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
    visited = my_done_gyms['gym_name'].unique().tolist()
    gym_urls = gym_df.set_index('gym_name')['profile_url'].to_dict()

    with g_tab1:
        last_visits = my_done_gyms.groupby('gym_name')['date'].max().sort_values()
        for g, d in last_visits.items():
            st.markdown(f'<div class="item-box"><div class="item-accent"></div><div class="item-date">{d.strftime("%m/%d")}</div><div class="item-icon">📍</div><div class="item-text"><a href="{gym_urls.get(g,"#")}" target="_blank" class="gym-link">{g}</a></div></div>', unsafe_allow_html=True)
    with g_tab2:
        unvisited = gym_df[~gym_df['gym_name'].isin(visited)].sort_values('gym_name')
        for _, row in unvisited.iterrows():
            st.markdown(f'<div class="item-box"><div class="item-accent" style="background:#CCC"></div><div class="item-date">NEW</div><div class="item-icon">🗺️</div><div class="item-text"><a href="{row["profile_url"]}" target="_blank" class="gym-link">{row["gym_name"]}</a> <small>({row["area_tag"]})</small></div></div>', unsafe_allow_html=True)

# ==========================================
# Tab 3: 📊 マイページ
# ==========================================
with tabs[2]:
    st.subheader("🗓️ 登る予定")
    my_plans = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'].dt.date >= date.today())].sort_values('date')
    if not my_plans.empty:
        for i, row in my_plans.iterrows():
            st.markdown(f'<div class="item-box"><div class="item-accent" style="background:#FFD700"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">✋</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
    else:
        st.info("これからの予定はありません。")
        
    st.subheader("📊 統計 & 予定")
    st.markdown("---")
    c1, c2 = st.columns(2)
    with c1: ms_date = st.date_input("開始", value=date.today().replace(day=1), key="ms")
    with c2: me_date = st.date_input("終了", value=date.today(), key="me")
    
    my_period_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['date'].dt.date >= ms_date) & (log_df['date'].dt.date <= me_date)].sort_values('date', ascending=False)
    my_period_res = my_period_logs[my_period_logs['type'] == '実績']
    
    ca, cb = st.columns(2)
    ca.markdown(f'<div class="insta-card">Total Sessions<br><span class="insta-val">{len(my_period_res)}</span></div>', unsafe_allow_html=True)
    cb.markdown(f'<div class="insta-card">Visited Gyms<br><span class="insta-val">{my_period_res["gym_name"].nunique() if not my_period_res.empty else 0}</span></div>', unsafe_allow_html=True)

    # ジム頻度グラフ
    if not my_period_res.empty:
        counts = my_period_res['gym_name'].value_counts().reset_index()
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color_discrete_sequence=['#DD2476'])
        fig.update_layout(xaxis_visible=False, yaxis_title=None, height=200, margin=dict(t=0,b=0,l=100,r=40), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.subheader("📝 履歴")
    for i, row in my_period_logs.iterrows():
        cc1, cc2 = st.columns([5, 1])
        cc1.markdown(f'<div class="item-box"><div class="item-accent" style="background:{"#B22222" if row["type"]=="実績" else "#FFD700"}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{"✅" if row["type"]=="実績" else "✋"}</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
        if cc2.button("🗑️", key=f"del_{i}"):
            conn.update(worksheet="climbing_logs", data=log_df.drop(i)); st.cache_data.clear(); st.rerun()

# ==========================================
# Tab 4: 👥 仲間 (スケジュール共有)
# ==========================================
with tabs[3]:
    st.subheader("👥 仲間の予定 (直近1ヶ月)")
    limit_dt = pd.to_datetime(date.today()) + timedelta(days=30)
    
    # 修正: 日付データが空(NaT)の行を除外してエラーを防ぐ
    valid_logs = log_df.dropna(subset=['date'])
    others = valid_logs[(valid_logs['user'] != st.session_state.USER) & 
                        (valid_logs['type'] == '予定') & 
                        (valid_logs['date'].dt.date >= date.today()) & 
                        (valid_logs['date'] <= limit_dt)].sort_values('date')
    
    if not others.empty:
        for _, row in others.iterrows():
            u_info = user_df[user_df['user'] == row['user']].iloc[0] if row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
            st.markdown(f'<div class="item-box"><div class="item-accent" style="background:{u_info["color"]}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{u_info["icon"]}</div><div class="item-text"><b>{row["user"]}</b> @ {row["gym_name"]}</div></div>', unsafe_allow_html=True)
    else:
        st.write("直近の仲間の予定はありません。")

# ==========================================
# Tab 5: 📅 セットスケジュール
# ==========================================
with tabs[4]:
    st.subheader("📅 セットスケジュール")
    if not sched_df.empty:
        # レイアウト修正版
        for _, row in sched_df.sort_values('start_date', ascending=True).iterrows():
            if pd.isna(row['start_date']): continue
            is_past = row['start_date'].date() < date.today()
            st.markdown(f'''
                <a href="{row.get("post_url","#")}" target="_blank" class="item-box {"past-opacity" if is_past else ""}">
                    <div class="item-accent" style="background:#B22222"></div>
                    <div class="item-date">{row["start_date"].strftime("%m/%d")}</div>
                    <div class="item-icon">🗓️</div>
                    <div class="item-text">{row["gym_name"]}</div>
                </a>
            ''', unsafe_allow_html=True)

# ==========================================
# Tab 6: ⚙️ 管理
# ==========================================
with tabs[5]:
    st.subheader("⚙️ 設定")
    with st.expander("🆕 ジム登録"):
        with st.form("admin_gym"):
            n, u, a = st.text_input("ジム名"), st.text_input("Instagram URL"), st.text_input("エリアタグ")
            if st.form_submit_button("登録"):
                new = pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new], ignore_index=True))
                st.cache_data.clear(); st.success("ジムを登録しました"); st.rerun()

    with st.expander("📅 セット登録"):
        selected_gym = st.selectbox("ジム", gym_df['gym_name'].tolist()) if not gym_df.empty else ""
        post_url = st.text_input("告知URL", key="admin_url")
        if "rows" not in st.session_state: st.session_state.rows = 1
        dates = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            sd = c1.date_input(f"開始日 {i+1}", key=f"asd_{i}")
            ed = c2.date_input(f"終了日 {i+1}", key=f"aed_{i}")
            dates.append((sd, ed))
        if st.button("➕ 日程追加"): st.session_state.rows += 1; st.rerun()
        if st.button("🚀 一括登録"):
            new_s = pd.DataFrame([[selected_gym, sd.isoformat(), ed.isoformat(), post_url] for sd, ed in dates], columns=['gym_name','start_date','end_date','post_url'])
            conn.update(worksheet="schedules", data=pd.concat([sched_df, new_s], ignore_index=True))
            st.session_state.rows = 1; st.cache_data.clear(); st.success("一括登録完了"); st.rerun()

    st.divider()
    if st.button("🚪 ログアウト"):
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
