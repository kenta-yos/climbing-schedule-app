import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime, date, timedelta
import calendar
import plotly.express as px

# --- 1. ページ設定 & CSS (変更なし) ---
st.set_page_config(page_title="Go Bouldering Pro", layout="centered")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    .main .block-container { font-family: 'Noto Sans JP', sans-serif; padding-top: 1.5rem; }

    .insta-card {
        background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%);
        color: white; padding: 12px 15px; border-radius: 15px; text-align: center;
        margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .insta-val { font-size: 2.2rem; font-weight: 800; }
    .insta-label { font-size: 0.8rem; opacity: 0.9; }

    /* 削除リンクのデザイン */
    .del-link {
        color: #999 !important;
        font-size: 0.75rem !important;
        text-decoration: underline !important; /* 下線をつけてリンクっぽく */
        cursor: pointer;
        margin-left: auto;
        padding: 5px;
    }
    .del-link:hover { color: #FF512F !important; }    
    
    .item-box {
        display: grid !important;
        grid-template-columns: 4px 60px 1fr 40px !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 14px 0 !important;
        border-bottom: 1px solid #F0F0F0 !important;
        text-decoration: none !important;
    }

    .set-box {
        display: grid !important;
        grid-template-columns: 4px 105px 1fr !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 15px 5px !important;
        border-bottom: 1px solid #F0F0F0 !important;
        text-decoration: none !important;
        width: 100% !important;
    }

    .item-accent { width: 4px !important; height: 1.4rem !important; border-radius: 2px !important; flex-shrink: 0; }
    
    .item-date { 
        color: #B22222 !important; 
        font-weight: 700 !important; 
        font-size: 0.85rem !important; 
        white-space: nowrap !important; 
        display: inline-block !important; 
    }
    .item-gym { 
        color: #1A1A1A !important; 
        font-weight: 700 !important; 
        font-size: 0.95rem !important; 
        word-break: break-all !important;
        line-height: 1.3 !important;
    }
    
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
    .past-opacity { opacity: 0.35 !important; }
    </style>
""", unsafe_allow_html=True)

conn = st.connection("gsheets", type=GSheetsConnection)

# --- 2. データ読み込み (引数 timestamp でキャッシュをコントロール) ---
@st.cache_data(ttl=3600)
def get_all_data(update_tick=0):
    # update_tick が変わったときだけ、キャッシュを無視してGoogleから再取得する仕組み
    try:
        data_dict = {}
        sheet_names = ["gym_master", "schedules", "climbing_logs", "users", "area_master"]
        for name in sheet_names:
            # ここでは conn.read を使う (ttlは1hでOK)
            df = conn.read(worksheet=name, ttl="1h")
            df.columns = [str(c).strip().lower() for c in df.columns]
            # 日付変換ロジック
            if name == "climbing_logs" and not df.empty and 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date'], errors='coerce').dt.tz_localize(None)
            elif name == "schedules" and not df.empty:
                for col in ['start_date', 'end_date']:
                    if col in df.columns:
                        df[col] = pd.to_datetime(df[col], errors='coerce').dt.tz_localize(None)            
            data_dict[name] = df
        return data_dict
    except Exception as e:
        st.error(f"❌ 読み込みエラー: {e}")
        st.stop()

# --- 3. セッション状態の初期化 (参照する前に作る) ---
if 'data_tick' not in st.session_state:
    st.session_state.data_tick = 0
if 'USER' not in st.session_state:
    st.session_state.USER = None

# --- 4. データの取得実行 ---
all_data = get_all_data(st.session_state.data_tick)

# --- データの割り当て ---
all_data = get_all_data()
gym_df = all_data.get("gym_master", pd.DataFrame())
sched_df = all_data.get("schedules", pd.DataFrame())
log_df = all_data.get("climbing_logs", pd.DataFrame())
user_df = all_data.get("users", pd.DataFrame())
area_master = all_data.get("area_master", pd.DataFrame())

# --- 保存用関数（安全版） ---
def safe_save(worksheet, df, target_tab=None):
    try:
        if df.empty:
            st.error("保存するデータが空です。処理を中断しました。")
            return

        save_df = df.copy()
        
        # 1. 日付をスプレッドシートの既存形式 "2025-11-27 0:00:00" に厳密に合わせる
        for col in ['date', 'start_date', 'end_date']:
            if col in save_df.columns:
                # 一旦datetimeに変換してから、時刻付き文字列フォーマットに固定
                save_df[col] = pd.to_datetime(save_df[col]).dt.strftime('%Y-%m-%d 00:00:00')
        
        # 2. 重複や空行を排除（念のため）
        save_df = save_df.dropna(subset=[save_df.columns[0]]) # 最初の列が空の行を削除
        
        # 3. Google Sheets更新
        conn.update(worksheet=worksheet, data=save_df)
        
        # 4. キャッシュをクリア
        st.session_state.data_tick = datetime.now().timestamp()
        
        # 5. タブを維持してリロード
        params = {"user": st.session_state.USER}
        if target_tab:
            params["tab"] = target_tab
        elif "tab" in st.query_params:
            params["tab"] = st.query_params["tab"]
        st.query_params.from_dict(params)
        
        st.rerun()
    except Exception as e:
        st.error(f"❌ 保存失敗: {e}")
        st.stop()

# --- 3. 認証 (安定化アップデート版) ---
# URLパラメータからユーザー復元
saved_user = st.query_params.get("user")
if saved_user and not user_df.empty and st.session_state.USER is None:
    u_match = user_df[user_df['user'] == saved_user]
    if not u_match.empty:
        row = u_match.iloc[0]
        st.session_state.USER = row['user']
        st.session_state.U_COLOR = row['color']
        st.session_state.U_ICON = row['icon']

# ★ここが重要：AttributeErrorを防ぐために .get() を使用
if not st.session_state.get('USER'):
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        for i, (_, row) in enumerate(user_df.iterrows()):
            with cols[i % 2]:
                btn_key = f"l_{row['user']}"
                st.markdown(f"<style>div.stButton > button[key='{btn_key}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user']}", key=btn_key):
                    st.session_state.USER = row['user']
                    st.session_state.U_COLOR = row['color']
                    st.session_state.U_ICON = row['icon']
                    st.query_params["user"] = row['user']
                    st.rerun()
    st.stop()

# ログイン後の時間を固定
today_ts = pd.Timestamp(date.today()).replace(hour=0, minute=0, second=0, microsecond=0)

# --- 4. タブ ---

col_title, col_btn = st.columns([0.7, 0.3])
with col_title:
    st.write(f"🧗 Let's Go Bouldering **{st.session_state.U_ICON} {st.session_state.USER}**")
with col_btn:
    if st.button("🔄 最新に更新", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# --- タブの制御ロジック ---
tab_titles = ["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"]

# 1. URLから現在のタブを取得
query_tab = st.query_params.get("tab", "🏠 Top")

# 2. もしURLのタブがリストにない変な値だったらTopに戻す
if query_tab not in tab_titles:
    query_tab = "🏠 Top"

# 3. タブを作成
tabs = st.tabs(tab_titles)

# 4. 【重要】各タブの中身を「URLと一致する場合のみ」表示する（またはURLを更新する）
# こうすることで、保存後に指定したタブがパッと開きます

# Tab 1: Top (変更なし)


# --- Tab 1: クイック登録のボタン処理も修正 ---
with tabs[0]: 
    st.query_params["tab"] = "🏠 Top"
    st.subheader("🚀 クイック登録")
    with st.form("quick_log", clear_on_submit=True):
        q_date = st.date_input("日程", value=date.today())
        q_gym = st.selectbox("ジムを選択", sorted(gym_df['gym_name'].tolist()) if not gym_df.empty else [], index=None, placeholder="ジムを選択")
        
        c1, c2 = st.columns(2)
        if c1.form_submit_button("✋ 登ります"):
            if q_gym:
                new_row = pd.DataFrame([[pd.to_datetime(q_date), q_gym, st.session_state.USER, '予定']], 
                                     columns=['date','gym_name','user','type'])
                # 既存のlog_dfに新しい行を「追加」して保存
                combined_df = pd.concat([log_df, new_row], ignore_index=True)
                safe_save("climbing_logs", combined_df, target_tab="🏠 Top")
            else:
                st.warning("ジムを選択してください")

        if c2.form_submit_button("✊ 登りました"):
            if q_gym:
                new_row = pd.DataFrame([[pd.to_datetime(q_date), q_gym, st.session_state.USER, '実績']], 
                                     columns=['date','gym_name','user','type'])
                combined_df = pd.concat([log_df, new_row], ignore_index=True)
                safe_save("climbing_logs", combined_df, target_tab="🏠 Top")
            else:
                st.warning("ジムを選択してください")

# Tab 2: ✨ ジム (マスタ連動・ラジオボタン版)
with tabs[1]:
    st.query_params["tab"] = "✨ ジム"
    st.subheader("✨ おすすめ")
    
    target_date = st.date_input("ターゲット日", value=date.today(), key="tg_date")
    t_dt = pd.to_datetime(target_date).replace(tzinfo=None)

    # エリア選択のラジオボタン
    major_choice = st.radio("表示範囲", ["都内・神奈川", "関東", "全国"], horizontal=True, index=0)

    # マスタから対象タグを抽出
    if major_choice == "全国":
        allowed_tags = gym_df['area_tag'].unique().tolist() if not gym_df.empty else []
    else:
        allowed_tags = area_master[area_master['major_area'] == major_choice]['area_tag'].tolist()

    ranked_list = []
    if not gym_df.empty:
        for _, gym in gym_df.iterrows():
            # マスタにないエリアはスキップ
            if gym['area_tag'] not in allowed_tags:
                continue

            name, score, reasons = gym['gym_name'], 0, []
            
            # --- 1. 鮮度スコア（セット終了日基準） ---
            if not sched_df.empty:
                past_sets = sched_df[(sched_df['gym_name'] == name) & (sched_df['end_date'] <= t_dt)]
                if not past_sets.empty:
                    latest_end = past_sets['end_date'].max()
                    diff = (t_dt - latest_end).days
                    if 0 <= diff <= 7: 
                        score += 40
                        reasons.append(f"🔥 新セット({diff}日前完了)")
                    elif 8 <= diff <= 14: 
                        score += 30
                        reasons.append(f"✨ 準新セット({diff}日前完了)")

            # --- 2. 仲間スコア ---
            others = log_df[(log_df['gym_name'] == name) & (log_df['user'] != st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] == t_dt)] if not log_df.empty else pd.DataFrame()
            if not others.empty:
                score += (50 * len(others))
                reasons.append(f"👥 仲間{len(others)}名が予定")
                
            # --- 3. 実績スコア ---
            my_v = log_df[(log_df['gym_name'] == name) & (log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')] if not log_df.empty else pd.DataFrame()
            if my_v.empty: 
                score += 10
                reasons.append("🆕 未訪問")
            else:
                last_v_days = (t_dt - my_v['date'].max()).days
                if last_v_days >= 30: 
                    score += 20
                    reasons.append(f"⌛ {last_v_days}日ぶり")

            ranked_list.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})
    
    # スコア上位6件を表示
    for gym in sorted(ranked_list, key=lambda x: x['score'], reverse=True)[:6]:
        tag_html = "".join([f'<span class="tag {"tag-hot" if "🔥" in r or "👥" in r else ""}">{r}</span>' for r in gym['reasons']])
        st.markdown(f'<div class="gym-card"><a href="{gym["url"]}" target="_blank" style="color:#007bff; font-weight:700; text-decoration:none;">{gym["name"]}</a> <small>({gym["area"]})</small><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)

    st.divider()
    g1, g2 = st.tabs(["🏢 訪問済", "🗺️ 未訪問"])
    visited_names = []
    if not log_df.empty:
        my_done_logs = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績')]
        visited_names = my_done_logs['gym_name'].unique().tolist()
        
    with g1: # 訪問済タブ
        if visited_names:
            # 日付でソート
            last_v_df = my_done_logs.groupby('gym_name')['date'].max().sort_values(ascending=False).reset_index()
            
            for _, row in last_v_df.iterrows():
                # --- ここを安全な書き方に変更 ---
                target_gym_name = row['gym_name']
                g_url = "#" # デフォルト
                
                if not gym_df.empty and 'gym_name' in gym_df.columns:
                    match = gym_df[gym_df['gym_name'] == target_gym_name]
                    if not match.empty and 'profile_url' in match.columns:
                        g_url = match['profile_url'].iloc[0]
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:#007bff !important"></div>
                        <span class="item-date">{row["date"].strftime("%Y/%m/%d")}</span>
                        <span class="item-gym">
                            <a href="{g_url}" target="_blank" style="color:inherit; text-decoration:none;">{target_gym_name}</a>
                        </span>
                        <div></div>
                    </div>
                ''', unsafe_allow_html=True)

    with g2:
        # 1. gym_df が空でなく、かつ必要な列があるかチェック
        if not gym_df.empty and 'gym_name' in gym_df.columns:
            # 未訪問のジムを抽出
            unv = gym_df[~gym_df['gym_name'].isin(visited_names)].sort_values('gym_name')
            
            for _, row in unv.iterrows():
                # 列の存在を確認しながら値を取得
                g_name = row.get('gym_name', 'Unknown')
                g_url = row.get('profile_url', '#')
                
                st.markdown(f'''
                    <div class="item-box">
                        <div class="item-accent" style="background:#CCC !important"></div>
                        <span class="item-date">NEW</span>
                        <span class="item-gym">
                            <a href="{g_url}" target="_blank" style="color:inherit; text-decoration:none;">{g_name}</a>
                        </span>
                    </div>
                ''', unsafe_allow_html=True)
        else:
            st.info("ジム情報が読み込めませんでした。更新ボタンを押してみてください。")

# Tab 3: マイページ (Sunsetdark & インスタ風)
with tabs[2]:
    st.query_params["tab"] = "📊 マイページ"
    st.subheader("🗓️ 今後の予定")
    my_plans = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '予定') & (log_df['date'] >= today_ts)].sort_values('date') if not log_df.empty else pd.DataFrame()
    for i, row in my_plans.iterrows():
        st.markdown(f'''
            <div class="item-box">
                <div class="item-accent" style="background:#4CAF50 !important"></div>
                <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                <div class="item-gym">{row["gym_name"]}</div>
            </div>
        ''', unsafe_allow_html=True)

        if st.button("🗑️ 削除", key=f"del_plan_{i}"):
            new_log_df = log_df.drop(i)
            safe_save("climbing_logs", new_log_df, target_tab="📊 マイページ")
    
    st.divider()
    sc1, sc2 = st.columns(2)
    ms, me = sc1.date_input("開始", value=date.today().replace(day=1)), sc2.date_input("終了", value=date.today())
    my_p_res = log_df[(log_df['user'] == st.session_state.USER) & (log_df['type'] == '実績') & (log_df['date'].dt.date >= ms) & (log_df['date'].dt.date <= me)] if not log_df.empty else pd.DataFrame()
    
    if not my_p_res.empty:
        st.markdown(f'<div class="insta-card"><div style="display: flex; justify-content: space-around;"><div><div class="insta-val">{len(my_p_res)}</div><div class="insta-label">Sessions</div></div><div><div class="insta-val">{my_p_res["gym_name"].nunique()}</div><div class="insta-label">Gyms</div></div></div></div>', unsafe_allow_html=True)
        counts = my_p_res['gym_name'].value_counts().reset_index(); counts.columns = ['gym_name', 'count']; counts = counts.sort_values('count', ascending=True)
        fig = px.bar(counts, x='count', y='gym_name', orientation='h', text='count', color='count', color_continuous_scale='Sunsetdark')
        fig.update_traces(texttemplate='  <b>%{text}回</b>', textposition='outside', hoverinfo='none')
        fig.update_layout(showlegend=False, coloraxis_showscale=False, xaxis_visible=False, yaxis_title=None, margin=dict(t=10, b=10, l=120, r=50), height=max(150, 45 * len(counts)), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', dragmode=False)
        st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False, 'staticPlot': True})

    st.subheader("📝 履歴")
    for i, row in my_p_res.sort_values('date', ascending=False).iterrows():
        st.markdown(f'''
            <div class="item-box">
                <div class="item-accent" style="background:#4CAF50 !important"></div>
                <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                <div class="item-gym">{row["gym_name"]}</div>
            </div>
        ''', unsafe_allow_html=True)
        if st.button("🗑️ 削除", key=f"del_plan_{i}"):
            new_log_df = log_df.drop(i)
            safe_save("climbing_logs", new_log_df, target_tab="📊 マイページ")

# Tab 4: 👥 仲間 (直近1ヶ月)
with tabs[3]:
    st.query_params["tab"] = "👥 仲間"
    st.subheader("👥 仲間の予定 (直近1ヶ月)")
    o_plans = log_df[(log_df['user']!=st.session_state.USER)&(log_df['type']=='予定')&(log_df['date']>=today_ts)&(log_df['date']<=today_ts+timedelta(days=30))].sort_values('date') if not log_df.empty else pd.DataFrame()
    for _, row in o_plans.iterrows():
        u = user_df[user_df['user'] == row['user']].iloc[0] if not user_df.empty and row['user'] in user_df['user'].values else {"icon":"👤", "color":"#CCC"}
        st.markdown(f'''
            <div class="item-box">
                <div class="item-accent" style="background:{u["color"]} !important"></div>
                <span class="item-date">{row["date"].strftime("%m/%d")}</span>
                <span class="item-gym">
                    <b>{u["icon"]} {row["user"]}</b> 
                    <span style="font-size:0.8rem; color:#666; margin-left:8px;">@{row["gym_name"]}</span>
                </span>
            </div>
        ''', unsafe_allow_html=True)

# Tab 5: 📅 セット (月選択 & Grid)
with tabs[4]:
    st.query_params["tab"] = "📅 セット"
    st.subheader("📅 セットスケジュール")
    if not sched_df.empty:
        s_df = sched_df.copy()
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        
        for _, row in s_df[s_df['month_year'] == sel_m].sort_values('start_date').iterrows():
            is_past = row['end_date'].date() < date.today()
            d_s = row['start_date'].strftime('%m/%d')
            d_e = row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            
            # <a>タグの中に直接 <div> と <span> を配置（余計な改行が入らないように一行で記述）
            st.markdown(f'''
                <a href="{row["post_url"]}" target="_blank" class="set-box {"past-opacity" if is_past else ""}">
                    <div class="item-accent" style="background:#B22222 !important"></div>
                    <span class="item-date">{d_disp}</span>
                    <span class="item-gym">{row["gym_name"]}</span>
                </a>
            ''', unsafe_allow_html=True)

# Tab 6: ⚙️ 管理
with tabs[5]:
    st.query_params["tab"] = "⚙️ 管理"    
    st.subheader("⚙️ 管理")
    with st.expander("🆕 ジム登録"):
        with st.form("adm_gym"):
            n, u, a = st.text_input("ジム名"), st.text_input("Instagram URL"), st.text_input("エリア")
            if st.form_submit_button("登録"):
                safe_save("gym_master", pd.concat([gym_df, pd.DataFrame([[n, u, a]], columns=['gym_name','profile_url','area_tag'])], ignore_index=True))
    with st.expander("📅 セット一括登録"):
        sel_g = st.selectbox(
            "対象ジム", 
            sorted(gym_df['gym_name'].tolist()), 
            index=None, 
            placeholder="ジムを選択してください"
        ) if not gym_df.empty else ""        
        p_url = st.text_input("告知URL")
        if "rows" not in st.session_state: st.session_state.rows = 1
        d_list = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            d_list.append((c1.date_input(f"開始 {i+1}", key=f"sd_{i}"), c2.date_input(f"終了 {i+1}", key=f"ed_{i}")))
        if st.button("➕ 日程追加"): st.session_state.rows += 1; st.rerun()
        if st.button("🚀 一括登録"):
            new_s = pd.DataFrame([[sel_g, d[0], d[1], p_url] for d in d_list], columns=['gym_name', 'start_date', 'end_date', 'post_url'])
            st.session_state.rows = 1
            safe_save("schedules", pd.concat([sched_df, new_s], ignore_index=True))
    if st.button("🚪 ログアウト"): st.session_state.USER = None; st.query_params.clear(); st.rerun()
