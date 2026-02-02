import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

# ページ設定
st.set_page_config(page_title="セット管理", layout="centered")

# セッション状態の初期化
if 'date_count' not in st.session_state:
    st.session_state.date_count = 1

# --- カスタムCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif; background-color: #F8F9FA; }
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important; border-radius: 12px !important; padding: 1.2rem !important;
        background-color: white !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        margin-bottom: 1rem !important;
    }
    .past-event { opacity: 0.5; filter: grayscale(1); }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; margin-bottom: 1.5rem !important; }
    h3 { font-size: 1.1rem !important; font-weight: 600 !important; margin: 0 !important; }
    .date-text { font-size: 0.95rem; font-weight: 700; color: #555; margin-bottom: 0.5rem; }
    label[data-testid="stWidgetLabel"] { font-size: 0.9rem !important; color: #666 !important; }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

# --- データ準備（よく行くジム順のマスター作成） ---
if not df.empty:
    # 登録回数が多い順にジム名を並べる
    gym_counts = df['gym_name'].value_counts()
    master_gym_list = gym_counts.index.tolist()
    
    # マイジム表示用に「最新の登録URL」を紐付けたデータフレーム
    # 最新の登録を上に持ってきてから重複削除することで、各ジムの最新URLを保持
    my_gyms_master = df.sort_values('date', ascending=False).drop_duplicates('gym_name')
    # 並び順を「よく行く順」に並び替え
    my_gyms_master['count'] = my_gyms_master['gym_name'].map(gym_counts)
    my_gyms_master = my_gyms_master.sort_values('count', ascending=False)
else:
    master_gym_list = []
    my_gyms_master = pd.DataFrame()

# --- メインナビゲーション ---
tab1, tab2 = st.tabs(["🗓 スケジュール", "🔍 マイジム（巡回用）"])

# ==========================================
# Tab 1: スケジュール管理
# ==========================================
with tab1:
    st.title("🧗‍♂️ セットスケジュール")
    
    with st.expander("＋ 登録", expanded=False):
        # マイジムの並び順（よく行く順）をそのまま選択肢に使用
        gym_options = ["(リストから選択)"] + master_gym_list + ["＋ 新規ジムを入力"]
        
        with st.form("add_form", clear_on_submit=True):
            selected_gym = st.selectbox("ジム名を選択（よく行く順）", options=gym_options)
            new_gym_name = st.text_input("新規ジム名")
            insta_url = st.text_input("Instagram URL (投稿のURL)")
            
            st.write("---")
            date_entries = []
            for i in range(st.session_state.date_count):
                st.markdown(f"**日程 {i+1}**")
                col1, col2 = st.columns(2)
                with col1: s_d = st.date_input(f"開始日", key=f"start_{i}")
                with col2: e_d = st.date_input(f"終了日", key=f"end_{i}")
                date_entries.append((s_d, e_d))
            submit = st.form_submit_button("予定を保存")
            
        if st.session_state.date_count < 5:
            if st.button("＋ 日程を追加"):
                st.session_state.date_count += 1
                st.rerun()

    if submit:
        final_gym = new_gym_name if selected_gym == "＋ 新規ジムを入力" else selected_gym
        if final_gym and final_gym != "(リストから選択)" and insta_url:
            new_rows = [{"gym_name": final_gym, "date": s.isoformat(), "end_date": e.isoformat(), "url": insta_url, "wall": ""} for s, e in date_entries]
            conn.update(data=pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True))
            st.session_state.date_count = 1
            st.success(f"{final_gym}を保存しました")
            st.rerun()

    # タイムライン表示
    current_month_str = datetime.now().strftime('%Y年%m月')
    if not df.empty:
        # 型変換
        temp_df = df.copy()
        temp_df['date'] = pd.to_datetime(temp_df['date'])
        temp_df['end_date'] = pd.to_datetime(temp_df['end_date'])
        today = pd.to_datetime(datetime.now().date())
        temp_df['month_year'] = temp_df['date'].dt.strftime('%Y年%m月')
        
        all_months = sorted(temp_df['month_year'].unique().tolist())
        if current_month_str not in all_months:
            all_months.append(current_month_str)
            all_months.sort()
        
        selected_month = st.selectbox("表示月を切り替え", options=all_months, index=all_months.index(current_month_str))
        month_df = temp_df[temp_df['month_year'] == selected_month].copy()
        
        if not month_df.empty:
            month_df['is_past'] = month_df['end_date'] < today
            month_df = month_df.sort_values(by=['is_past', 'date'], ascending=[True, True])
            for _, row in month_df.iterrows():
                period = f"{row['date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}"
                wrapper_class = "past-event" if row['is_past'] else ""
                st.markdown(f"<div class='{wrapper_class}'>", unsafe_allow_html=True)
                with st.container(border=True):
                    st.markdown(f"<div class='date-text'>🗓 {period}</div>", unsafe_allow_html=True)
                    col_info, col_link = st.columns([2, 1])
                    with col_info: st.markdown(f"### {row['gym_name']}")
                    with col_link: st.link_button("詳細確認", row['url'], use_container_width=True)
                st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.info("予定がありません。")

# ==========================================
# Tab 2: マイジム巡回（よく行く順リスト）
# ==========================================
with tab2:
    st.title("🔍 マイジム")
    st.caption("よく行く順に並んでいます。インスタをチェックして情報を集めましょう。")
    
    if not my_gyms_master.empty:
        for _, row in my_gyms_master.iterrows():
            with st.container(border=True):
                c1, c2 = st.columns([2, 1])
                with c1:
                    st.markdown(f"### {row['gym_name']}")
                    # 登録回数をバッジのように表示（おまけ機能）
                    st.caption(f"通算登録数: {int(row['count'])}回")
                with c2:
                    st.link_button("インスタを開く", row['url'], use_container_width=True)
    else:
        st.info("まだ登録されたジムがありません。")
