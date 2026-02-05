import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import plotly.express as px
import pytz
import uuid
from st_supabase_connection import SupabaseConnection

# --- 日本時間の定義 ---
jp_timezone = pytz.timezone('Asia/Tokyo')
now_jp = datetime.now(jp_timezone)
today_jp = now_jp.date()

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
    .item-date { color: #B22222 !important; font-weight: 700 !important; font-size: 0.85rem !important; white-space: nowrap !important; display: inline-block !important; }
    .item-gym { color: #1A1A1A !important; font-weight: 700 !important; font-size: 0.95rem !important; word-break: break-all !important; line-height: 1.3 !important; }
    .gym-card { padding: 15px; background: #FFF; border-radius: 12px; border: 1px solid #E9ECEF; margin-bottom: 12px; }
    .tag-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 40px; background: #F0F0F0; color: #666; }
    .tag-hot { background: #FFF0F0; color: #FF512F; font-weight: 700; border: 1px solid #FFDADA; }
    .past-opacity { opacity: 0.35 !important; }
    </style>
""", unsafe_allow_html=True)

# セッション状態の初期化
if 'USER' not in st.session_state:
    st.session_state.USER = None

# --- 2. Supabase 接続設定 ---
conn = st.connection("supabase", type=SupabaseConnection)

def get_supabase_data(table_name):
    """詳細なエラー表示付きのデータ読み込み"""
    @st.cache_data(ttl=10) # テストのため一旦10秒キャッシュに短縮
    def _read(name):
        try:
            # .select("*") の後に .execute() を実行
            res = conn.table(name).select("*").execute()
            
            # デバッグ用にレスポンスの生データを表示（成功したら消します）
            if not res.data:
                st.info(f"Supabaseからの返り値が空です (Table: {name})")
                return pd.DataFrame()
            
            df = pd.DataFrame(res.data)
            
            # 日付型の列を変換
            date_cols = ['date', 'start_date', 'end_date', 'created_at']
            for col in date_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col]).dt.tz_localize(None)
            return df
        except Exception as e:
            st.error(f"テーブル {name} の読み込み中にエラーが発生しました:\n{e}")
            return pd.DataFrame()
            
    return _read(table_name)

# データの取得
gym_df = get_supabase_data("gym_master")
sched_df = get_supabase_data("set_schedules") # テーブル名を合わせました
log_df = get_supabase_data("climbing_logs")
user_df = get_supabase_data("users")
area_master = get_supabase_data("area_master")

# --- 3. 保存・削除処理 (Supabase版) ---
def safe_save(table: str, df_input: pd.DataFrame, mode: str = "add", target_tab: str = None):
    try:
        if df_input.empty and mode == "add":
            return

        if mode == "add":
            # 辞書形式に変換して一括挿入
            # IDやcreated_atはSupabase側で自動生成される設定なら不要ですが、念のため付与
            data_to_insert = df_input.to_dict(orient="records")
            for d in data_to_insert:
                if 'id' not in d: d['id'] = str(uuid.uuid4())
                # dateがdatetimeオブジェクトの場合は文字列にする
                if 'date' in d and isinstance(d['date'], datetime):
                    d['date'] = d['date'].isoformat()
            
            conn.table(table).insert(data_to_insert).execute()

        elif mode == "delete":
            # IDを指定して1件削除
            target_id = df_input
            conn.table(table).delete().eq("id", target_id).execute()

        st.cache_data.clear() # キャッシュを消して最新にする
        st.toast("✅ 完了しました！", icon="🚀")
        
        # リダイレクト
        params = {"user": st.session_state.USER}
        if target_tab: params["tab"] = target_tab
        st.query_params.from_dict(params)
        st.rerun()

    except Exception as e:
        st.error(f"⚠️ エラー: {e}")

# --- ヘルパー関数 (変更なし) ---
def format_users_inline(users, me):
    names = []
    for u in users:
        if u == me: names.append('<span style="color:#FF512F; font-weight:700;">me</span>')
        else: names.append(u)
    return " & ".join(names)

def render_inline_list(title, target_date, grouped_df):
    st.subheader(title)
    rows = grouped_df[grouped_df['date'].dt.date == target_date.date()] if not grouped_df.empty else pd.DataFrame()
    if rows.empty:
        st.caption("誰もいないよ😢のぼろ？")
        return
    for _, row in rows.iterrows():
        users_html = format_users_inline(row['user'], st.session_state.USER)
        st.markdown(f'<div style="display: grid; grid-template-columns: 160px 1fr; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 0.9rem;"><div style="font-weight:700; color:#222;">{row["gym_name"]}</div><div style="color:#555;">{users_html}</div></div>', unsafe_allow_html=True)

# --- 4. ログイン処理 (変更なし) ---
saved_user = st.query_params.get("user")
if saved_user and not user_df.empty and st.session_state.USER is None:
    u_match = user_df[user_df['user_name'] == saved_user]
    if not u_match.empty:
        st.session_state.USER, st.session_state.U_COLOR, st.session_state.U_ICON = u_match.iloc[0][['user_name', 'color', 'icon']]

if not st.session_state.get('USER'):
    st.title("🧗 Go Bouldering")
    if not user_df.empty:
        cols = st.columns(2)
        sorted_user_df = user_df.sort_values("user_name")
        for i, (_, row) in enumerate(sorted_user_df.iterrows()):
            with cols[i % 2]:
                btn_key = f"l_{row['user_name']}"
                st.markdown(f"<style>div.stButton > button[key='{btn_key}'] {{ background:{row['color']}; color:white; width:100%; height:4rem; border-radius:15px; font-weight:bold; }}</style>", unsafe_allow_html=True)
                if st.button(f"{row['icon']} {row['user_name']}", key=btn_key):
                    st.session_state.USER = row['user_name']
                    st.session_state.U_COLOR = row['color']
                    st.session_state.U_ICON = row['icon']
                    st.query_params["user"] = row['user_name']
                    st.rerun()
    st.stop()

# --- 5. メイン画面 ---
today_ts = pd.Timestamp(today_jp)

col_title, col_btn = st.columns([0.7, 0.3])
with col_title: st.write(f"🧗 Let's Go Bouldering **{st.session_state.U_ICON} {st.session_state.USER}**")
with col_btn:
    if st.button("🔄 更新", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

tab_titles = ["🏠 Top", "✨ ジム", "📊 マイページ", "👥 仲間", "📅 セット", "⚙️ 管理"]
query_tab = st.query_params.get("tab", "🏠 Top")
active_tab_idx = tab_titles.index(query_tab) if query_tab in tab_titles else 0
tabs = st.tabs(tab_titles)

# --- Tab 1: 🏠 Top ---
with tabs[0]:
    st.query_params["tab"] = "🏠 Top"
    st.subheader("🚀 クイック登録")

    # ジムリスト作成
    if not gym_df.empty and not area_master.empty:
        merged_gyms = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
        priority = ["都内・神奈川", "関東", "全国"]
        sorted_gym_names = []
        for p in priority:
            subset = merged_gyms[merged_gyms['major_area'] == p].sort_values('gym_name')
            sorted_gym_names.extend(subset['gym_name'].tolist())
    else:
        sorted_gym_names = sorted(gym_df['gym_name'].tolist()) if not gym_df.empty else []

    with st.form("quick_log_form", clear_on_submit=True):
        q_date = st.date_input("📅 日程", value=today_jp)
        with st.expander("🏢 ジムを選択"):
            q_gym = st.radio("ジム一覧", options=sorted_gym_names, index=None, label_visibility="collapsed")
        
        c1, c2 = st.columns(2)
        if c1.form_submit_button("✋ 登ります", use_container_width=True) and q_gym:
            new_row = pd.DataFrame([{'date': pd.to_datetime(q_date), 'gym_name': q_gym, 'user': st.session_state.USER, 'type': '予定'}])
            safe_save("climbing_logs", new_row, mode="add", target_tab="🏠 Top")
        if c2.form_submit_button("✊ 登りました", use_container_width=True) and q_gym:
            new_row = pd.DataFrame([{'date': pd.to_datetime(q_date), 'gym_name': q_gym, 'user': st.session_state.USER, 'type': '実績'}])
            safe_save("climbing_logs", new_row, mode="add", target_tab="🏠 Top")

    # 今日の予定
    plans_2days = log_df[(log_df['type'] == '予定') & (log_df['date'].dt.date.isin([today_jp, today_jp + timedelta(days=1)]))] if not log_df.empty else pd.DataFrame()
    grouped = plans_2days.groupby(['date', 'gym_name'])['user'].apply(list).reset_index() if not plans_2days.empty else pd.DataFrame()
    render_inline_list("🔥 今日どこ登る？", today_ts, grouped)
    render_inline_list("👀 明日は誰かいる？", today_ts + timedelta(days=1), grouped)

# --- Tab 2: ✨ ジム ---
with tabs[1]:
    st.query_params["tab"] = "✨ ジム"
    target_date = st.date_input("ターゲット日", value=today_jp)
    t_dt = pd.to_datetime(target_date)
    major_choice = st.radio("表示範囲", ["都内・神奈川", "関東", "全国"], horizontal=True)

    allowed_tags = area_master[area_master['major_area'] == major_choice]['area_tag'].tolist() if major_choice != "全国" else gym_df['area_tag'].unique().tolist()

    ranked = []
    for _, gym in gym_df[gym_df['area_tag'].isin(allowed_tags)].iterrows():
        name, score, reasons = gym['gym_name'], 0, []
        # スコアロジック (簡略化)
        others = log_df[(log_df['gym_name'] == name) & (log_df['date'] == t_dt) & (log_df['type'] == '予定')] if not log_df.empty else pd.DataFrame()
        if not others.empty: score += 50; reasons.append(f"👥 仲間{len(others)}名")
        ranked.append({"name": name, "score": score, "reasons": reasons, "area": gym['area_tag'], "url": gym['profile_url']})

    for g in sorted(ranked, key=lambda x: x['score'], reverse=True)[:6]:
        tag_html = "".join([f'<span class="tag tag-hot">{r}</span>' for r in g['reasons']])
        st.markdown(f'<div class="gym-card"><a href="{g["url"]}" target="_blank" style="font-weight:700;">{g["name"]}</a> <small>({g["area"]})</small><div class="tag-container">{tag_html}</div></div>', unsafe_allow_html=True)

# --- Tab 3: 📊 マイページ ---
with tabs[2]:
    st.query_params["tab"] = "📊 マイページ"
    my_logs = log_df[log_df['user'] == st.session_state.USER] if not log_df.empty else pd.DataFrame()
    
    st.subheader("🗓️ 予定")
    for i, row in my_logs[my_logs['type']=='予定'].sort_values('date').iterrows():
        col1, col2 = st.columns([0.8, 0.2])
        col1.markdown(f'<div class="item-box"><div class="item-accent" style="background:#4CAF50"></div><span class="item-date">{row["date"].strftime("%m/%d")}</span><div class="item-gym">{row["gym_name"]}</div></div>', unsafe_allow_html=True)
        if col2.button("🗑️", key=f"del_p_{row['id']}"):
            safe_save("climbing_logs", row['id'], mode="delete", target_tab="📊 マイページ")

    st.subheader("📊 実績")
    my_done = my_logs[my_logs['type']=='実績']
    if not my_done.empty:
        st.markdown(f'<div class="insta-card"><div style="display:flex; justify-content:space-around;"><div><div class="insta-val">{len(my_done)}</div><div class="insta-label">Sessions</div></div></div></div>', unsafe_allow_html=True)

# Tab 5: 📅 セット (Supabase版・レイアウト修正)
with tabs[4]:
    st.query_params["tab"] = "📅 セット"
    st.subheader("📅 セットスケジュール")
    
    if not sched_df.empty:
        s_df = sched_df.copy()
        
        # 表示用の月リストを作成 (Timestamp型を考慮)
        s_df['month_year'] = s_df['start_date'].dt.strftime('%Y年%m月')
        months = sorted(s_df['month_year'].unique().tolist(), reverse=True)
        
        # 現在の月をデフォルト選択
        cur_m = datetime.now().strftime('%Y年%m月')
        sel_m = st.selectbox("表示月", options=months, index=months.index(cur_m) if cur_m in months else 0)
        
        # 選択された月のデータを表示
        target_month_df = s_df[s_df['month_year'] == sel_m].sort_values('start_date')
        
        for _, row in target_month_df.iterrows():
            # 日付の比較用に date 型に変換
            is_past = row['end_date'].date() < today_jp
            
            # 表示用の日付文字列を作成
            d_s = row['start_date'].strftime('%m/%d')
            d_e = row['end_date'].strftime('%m/%d')
            d_disp = d_s if d_s == d_e else f"{d_s}-{d_e}"
            
            # レイアウト崩れ防止：HTML構造を整理
            st.markdown(f'''
                <a href="{row["post_url"]}" target="_blank" style="text-decoration: none;">
                    <div class="set-box {"past-opacity" if is_past else ""}" style="
                        display: grid;
                        grid-template-columns: 4px 105px 1fr;
                        align-items: center;
                        gap: 12px;
                        padding: 15px 5px;
                        border-bottom: 1px solid #F0F0F0;
                        width: 100%;
                    ">
                        <div class="item-accent" style="background:#B22222 !important; width: 4px; height: 1.4rem; border-radius: 2px;"></div>
                        <span class="item-date" style="color: #B22222; font-weight: 700; font-size: 0.85rem; white-space: nowrap;">{d_disp}</span>
                        <span class="item-gym" style="color: #1A1A1A; font-weight: 700; font-size: 0.95rem;">{row["gym_name"]}</span>
                    </div>
                </a>
            ''', unsafe_allow_html=True)
    else:
        st.info("セットスケジュールが登録されていません。")

# Tab 6: ⚙️ 管理 (セット一括登録・完全復活版)
with tabs[5]:
    st.query_params["tab"] = "⚙️ 管理"    
    st.subheader("⚙️ 管理メニュー")

    # --- 🆕 ジム登録 ---
    with st.expander("🆕 ジムの新規登録"):
        with st.form("adm_gym", clear_on_submit=True):
            n = st.text_input("ジム名（例: B-PUMP Ogikubo）")
            u = st.text_input("Instagram等のURL")
            a = st.text_input("エリアタグ（例: tokyo）")
            if st.form_submit_button("登録"):
                if n and a:
                    new_gym = pd.DataFrame([{'gym_name': n, 'profile_url': u, 'area_tag': a}])
                    safe_save("gym_master", new_gym, mode="add", target_tab="⚙️ 管理")
                else:
                    st.warning("ジム名とエリアは必須です")

    # --- 📅 セット一括登録 (復活) ---
    with st.expander("📅 セットスケジュール登録", expanded=True):
        
        # セレクトボックスの選択肢
        gym_options = sorted(gym_df['gym_name'].tolist()) if not gym_df.empty else []
        sel_g = st.selectbox(
            "対象ジム", 
            options=gym_options, 
            index=None, 
            placeholder="ジムを選択...",
            key="admin_sel_gym"
        )
            
        p_url = st.text_input("告知URL (Instagramなど)", key="admin_post_url")
        
        # 追加ボタンなどの状態管理
        if "rows" not in st.session_state: 
            st.session_state.rows = 1
            
        d_list = []
        for i in range(st.session_state.rows):
            c1, c2 = st.columns(2)
            # st.date_input の返り値は自動的に datetime.date 型になる
            sd = c1.date_input(f"開始 {i+1}", value=today_jp, key=f"sd_{i}")
            ed = c2.date_input(f"終了 {i+1}", value=today_jp, key=f"ed_{i}")
            d_list.append((sd, ed))
            
        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("➕ 日程欄を追加"): 
            st.session_state.rows += 1
            st.rerun()
            
        if col_btn2.button("🚀 Supabaseへ一括登録", use_container_width=True):
            if sel_g and p_url:
                new_s_list = []
                for d in d_list:
                    new_s_list.append({
                        'gym_name': sel_g,
                        'start_date': d[0].isoformat(), # date型を文字列へ
                        'end_date': d[1].isoformat(),
                        'post_url': p_url
                    })
                
                new_s_df = pd.DataFrame(new_s_list)
                
                # 入力欄をリセットするための処理
                st.session_state.rows = 1
                # safe_save を実行 (table名を set_schedules に合わせています)
                safe_save("set_schedules", new_s_df, mode="add", target_tab="📅 セット")
            else:
                st.error("ジムの選択と告知URLの入力は必須です。")

    # --- 🚪 ログアウト ---
    st.write("")
    if st.button("🚪 ログアウト", use_container_width=True): 
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
