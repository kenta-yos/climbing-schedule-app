import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px

# --- ページ設定 ---
st.set_page_config(page_title="Go Bouldering", layout="centered")

# --- CSS定義（タイル型ログイン・カードデザイン・アイテムリスト） ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1rem; }
    
    /* カード・タグ */
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .gym-title { font-size: 1.1rem; font-weight: 700; color: #1A1A1A; text-decoration: none; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; font-weight: 500; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }

    /* Gridリスト（セット・仲間用） */
    .item-box { display: grid; grid-template-columns: 4px 50px 30px 1fr; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #F8F8F8; text-decoration: none; }
    .item-accent { width: 4px; height: 1.2rem; border-radius: 2px; }
    .item-date { font-size: 0.8rem; font-weight: 700; color: #B22222; }
    .item-icon { font-size: 1rem; text-align: center; }
    .item-text { font-size: 0.9rem; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .past-opacity { opacity: 0.35; }

    /* 分析カード */
    .insta-card { background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: white; padding: 15px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
    .insta-val { font-size: 2rem; font-weight: 800; }
    </style>
""", unsafe_allow_html=True)

# --- データ取得関数（頑健版） ---
conn = st.connection("gsheets", type=GSheetsConnection)

def load_data():
    try:
        # ttl=0で最新取得
        gyms = conn.read(worksheet="gym_master", ttl=0).dropna(how='all')
        sched = conn.read(worksheet="schedules", ttl=0).dropna(how='all')
        logs = conn.read(worksheet="climbing_logs", ttl=0).dropna(how='all')
        users = conn.read(worksheet="users", ttl=0).dropna(how='all')
        
        # 全カラム名を「空白なし小文字」に統一
        for df in [gyms, sched, logs, users]:
            df.columns = [str(c).strip().lower() for c in df.columns]
        
        # 日付変換（不正データ・空欄ガード付き）
        if not sched.empty and 'start_date' in sched.columns:
            sched['start_date'] = pd.to_datetime(sched['start_date'], errors='coerce')
        if not logs.empty and 'date' in logs.columns:
            logs['date'] = pd.to_datetime(logs['date'], errors='coerce')
            
        return gyms, sched, logs, users
    except Exception as e:
        st.error(f"データ接続エラー: {e}")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

# 初回データ読み込み
gym_df, sched_df, log_df, user_df = load_data()

# --- セッション初期化（AttributeError対策） ---
if 'USER' not in st.session_state: st.session_state.USER = None
if 'U_COLOR' not in st.session_state: st.session_state.U_COLOR = "#CCC"
if 'U_ICON' not in st.session_state: st.session_state.U_ICON = "👤"

# --- 自動ログイン処理（URLパラメータ復元） ---
if st.session_state.USER is None:
    params = st.query_params
    if "user" in params and not user_df.empty:
        saved_user = params["user"]
        if 'user' in user_df.columns:
            u_match = user_df[user_df['user'].astype(str) == str(saved_user)]
            if not u_match.empty:
                u_info = u_match.iloc[0]
                st.session_state.USER = u_info['user']
                st.session_state.U_COLOR = u_info['color']
                st.session_state.U_ICON = u_info['icon']

# --- ログイン画面（タイル型ボタン） ---
if not st.session_state.USER:
    st.title("🧗 Go Bouldering")
    st.subheader("自分を選んでスタート")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                # ユーザー固有カラーのボタン
                st.markdown(f"""
                    <style>
                    div.stButton > button[key="login_{row['user']}"] {{
                        background-color: {row['color']}; color: white; border: none;
                        width: 100%; height: 4rem; border-radius: 15px; font-weight: bold; font-size: 1.1rem; margin-bottom: 10px;
                    }}
                    </style>
                """, unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=f"login_{row['user']}"):
                    st.session_state.USER = row['user']
                    st.session_state.U_COLOR = row['color']
                    st.session_state.U_ICON = row['icon']
                    st.query_params["user"] = row['user']
                    st.rerun()
    else:
        st.warning("usersシートを確認してください。")
    st.stop()

# --- メインコンテンツ ---
tab1, tab2, tab3, tab4, tab5 = st.tabs(["🏠 Top", "📊 ログ", "📅 セット", "👥 仲間", "⚙️ 管理"])

# ==========================================
# Tab 1: 🏠 Top
# ==========================================
with tab1:
    st.subheader("🎯 今日のプラン")
    c1, c2 = st.columns(2)
    with c1: target_date = st.date_input("ターゲット日", value=date.today())
    with c2: 
        area_list = ["すべて"] + sorted(gym_df['area_tag'].unique().tolist()) if not gym_df.empty else ["すべて"]
        sel_area = st.selectbox("エリア絞り込み", area_list)

    def calculate_scores(t_date):
        t_dt = pd.to_datetime(t_date)
        res = []
        if gym_df.empty: return []
        for _, gym in gym_df.iterrows():
            if sel_area != "すべて" and gym.get('area_tag') != sel_area: continue
            name, score, reasons = gym.get('gym_name'), 0, []
            
            # 1. 新セット判定
            if not sched_df.empty:
                g_s = sched_df[sched_df['gym_name'] == name]
                valid_sets = g_s['start_date'].dropna()
                if not valid_sets.empty:
                    last_set = valid_sets.max()
                    if isinstance(last_set, pd.Timestamp):
                        diff = (t_dt - last_set).days
                        if 0 <= diff <= 7: score += 50; reasons.append(f"🔥 新セット({diff}日前)")
                        elif 0 <= diff <= 14: score += 25; reasons.append("✨ 準新セット")

            # 2. 久々の訪問 / 未訪問
            if not log_df.empty:
                my_v = log_df[(log_df['gym_name'] == name) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
                valid_logs = my_v['date'].dropna()
                if valid_logs.empty:
                    score += 30; reasons.append("🆕 未訪問")
                else:
                    last_v = valid_logs.max()
                    if isinstance(last_v, pd.Timestamp):
                        v_diff = (t_dt - last_v).days
                        if v_diff >= 30: score += 30; reasons.append(f"⌛ {v_diff}日ぶり")

            # 3. 仲間の存在
            others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == t_dt)]
            if not others.empty:
                score += (15 * len(others))
                icons = "".join([user_df[user_df['user']==u]['icon'].iloc[0] for u in others['user'] if u in user_df['user'].values])
                reasons.append(f"👥 {icons} {len(others)}名の予定")

            res.append({"name": name, "score": score, "reasons": reasons, "area": gym.get('area_tag'), "url": gym.get('profile_url', '#')})
        return sorted(res, key=lambda x: x['score'], reverse=True)

    ranked = calculate_scores(target_date)
    for gym in ranked[:3]:
        with st.container():
            tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
            st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" class="gym-title">{gym["name"]}</a><span style="font-size:0.7rem; color:#888; margin-left:8px;">{gym["area"]}</span><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)
            cc1, cc2, cc3 = st.columns(3)
            # 状態チェック
            has_plan = not log_df[(log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定')].empty
            
            if cc1.button("✋ 登るぜ", key=f"p_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '予定']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            if cc2.button("✅ 登った", key=f"r_{gym['name']}"):
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([log_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
            if has_plan and cc3.button("🔄 実績に", key=f"c_{gym['name']}"):
                base = log_df[~((log_df['date'] == pd.to_datetime(target_date)) & (log_df['gym_name'] == gym['name']) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定'))]
                new = pd.DataFrame([[target_date.isoformat(), gym['name'], st.session_state.USER, '実績']], columns=['date','gym_name','user','type'])
                conn.update(worksheet="climbing_logs", data=pd.concat([base, new], ignore_index=True)); st.cache_data.clear(); st.rerun()

    st.markdown("---")
    v_tab1, v_tab2 = st.tabs(["🏢 訪問済", "🗺️ 未訪問"])
    my_done = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
    visited_names = my_done['gym_name'].unique().tolist()
    with v_tab1:
        if visited_names:
            last_v = my_done.groupby('gym_name')['date'].max().dt.strftime('%Y/%m/%d').to_dict()
            for g in sorted(visited_names, key=lambda x: last_v.get(x, "")):
                st.markdown(f'<div style="display:flex; justify-content:space-between; padding:8px; background:#F8F9FA; border-radius:8px; margin-bottom:4px; border:1px solid #EEE;"><b>{g}</b><small>Last: {last_v.get(g)}</small></div>', unsafe_allow_html=True)
    with v_tab2:
        for _, row in gym_df[~gym_df['gym_name'].isin(visited_names)].iterrows():
            st.markdown(f'<div style="padding:8px; background:#F8F9FA; border-radius:8px; margin-bottom:4px; border:1px solid #EEE;"><b>{row["gym_name"]}</b> <small>({row["area_tag"]})</small></div>', unsafe_allow_html=True)

# ==========================================
# Tab 2: 📊 ログ
# ==========================================
with tab2:
    st.subheader("分析 & 履歴")
    c1, c2 = st.columns(2)
    with c1: s_date = st.date_input("開始", value=date.today().replace(day=1))
    with c2: e_date = st.date_input("終了", value=date.today() + timedelta(days=30))
    my_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['date'].dt.date >= s_date) & (log_df['date'].dt.date <= e_date)].sort_values('date', ascending=False)
    my_res = my_logs[my_logs['type'] == '実績']
    ca, cb = st.columns(2)
    ca.markdown(f'<div class="insta-card">Sessions<br><span class="insta-val">{len(my_res)}</span></div>', unsafe_allow_html=True)
    cb.markdown(f'<div class="insta-card">Gyms<br><span class="insta-val">{my_res["gym_name"].nunique() if not my_res.empty else 0}</span></div>', unsafe_allow_html=True)
    for i, row in my_logs.iterrows():
        cc1, cc2 = st.columns([5, 1])
        cc1.markdown(f'<div class="item-box"><div class="item-accent" style="background:{"#B22222" if row["type"]=="実績" else "#FFD700"}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{"✅" if row["type"]=="実績" else "✋"}</div><div class="item-text">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
        if cc2.button("🗑️", key=f"del_{i}"):
            conn.update(worksheet="climbing_logs", data=log_df.drop(i)); st.cache_data.clear(); st.rerun()

# ==========================================
# Tab 3: 📅 セット
# ==========================================
with tab3:
    st.subheader("セットスケジュール")
    if not sched_df.empty:
        for _, row in sched_df.sort_values('start_date').iterrows():
            if pd.isna(row['start_date']): continue
            is_past = row['start_date'].date() < target_date
            st.markdown(f'<a href="{row.get("post_url","#")}" target="_blank" class="item-box {"past-opacity" if is_past else ""}"><div class="item-accent" style="background:#B22222"></div><div class="item-date">{row["start_date"].strftime("%m/%d")}</div><div class="item-icon">🗓️</div><div class="item-text">{row["gym_name"]}</div></a>', unsafe_allow_html=True)

# ==========================================
# Tab 4: 👥 仲間
# ==========================================
with tab4:
    st.subheader("仲間の予定")
    one_month = pd.to_datetime(target_date) + timedelta(days=30)
    others = log_df[(log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] >= pd.to_datetime(target_date)) & (log_df['date'] <= one_month)].sort_values('date')
    for _, row in others.iterrows():
        u_info = user_df[user_df['user'] == row['user']].iloc[0] if row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
        st.markdown(f'<div class="item-box"><div class="item-accent" style="background:{u_info["color"]}"></div><div class="item-date">{row["date"].strftime("%m/%d")}</div><div class="item-icon">{u_info["icon"]}</div><div class="item-text"><b>{row["user"]}</b> @ {row["gym_name"]}</div></div>', unsafe_allow_html=True)

# ==========================================
# Tab 5: ⚙️ 管理
# ==========================================
with tab5:
    st.button("ログアウト", on_click=lambda: (st.session_state.update(USER=None), st.query_params.clear()))
    with st.expander("🆕 ジム登録"):
        with st.form("g"):
            gn, ga, gu = st.text_input("ジム名"), st.text_input("エリア"), st.text_input("URL")
            if st.form_submit_button("登録"):
                new = pd.DataFrame([[gn, gu, ga]], columns=['gym_name','profile_url','area_tag'])
                conn.update(worksheet="gym_master", data=pd.concat([gym_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
    with st.expander("📅 セット登録"):
        with st.form("s"):
            sgn = st.selectbox("ジム", gym_df['gym_name'].tolist()) if not gym_df.empty else st.text_input("ジム名")
            sd, ed, pu = st.date_input("開始"), st.date_input("終了"), st.text_input("告知URL")
            if st.form_submit_button("登録"):
                new = pd.DataFrame([[sgn, sd.isoformat(), ed.isoformat(), pu]], columns=['gym_name','start_date','end_date','post_url'])
                conn.update(worksheet="schedules", data=pd.concat([sched_df, new], ignore_index=True)); st.cache_data.clear(); st.rerun()
