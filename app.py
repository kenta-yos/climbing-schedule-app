import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

# ページ設定
st.set_page_config(page_title="セットスケジュール", layout="centered")

# セッション状態の初期化（日程追加用）
if 'date_count' not in st.session_state:
    st.session_state.date_count = 1

# --- カスタムCSS ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
    html, body, [class*="css"] {
        font-family: 'Noto Sans JP', sans-serif;
        background-color: #F8F9FA;
    }
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important;
        border-radius: 12px !important;
        padding: 1.2rem !important;
        background-color: white !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        margin-bottom: 1rem !important;
    }
    .past-event { opacity: 0.5; filter: grayscale(1); }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; margin-bottom: 1.5rem !important; }
    h3 { font-size: 1.15rem !important; font-weight: 600 !important; margin: 0 !important; }
    .date-text { font-size: 0.95rem; font-weight: 700; color: #555; margin-bottom: 0.5rem; }
    /* セレクトボックスのラベルを少し小さく */
    label[data-testid="stWidgetLabel"] { font-size: 0.9rem !important; color: #666 !important; }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ セットスケジュール")

# --- 登録セクション ---
with st.expander("＋ 登録", expanded=False):
    with st.form("add_form", clear_on_submit=True):
        gym_name = st.text_input("ジム名", placeholder="例: B-PUMP 荻窪")
        insta_url = st.text_input("Instagram URL")
        
        st.write("---")
        # 動的な日程入力欄
        date_entries = []
        for i in range(st.session_state.date_count):
            st.markdown(f"**日程 {i+1}**")
            col1, col2 = st.columns(2)
            with col1: s_d = st.date_input(f"開始日", key=f"start_{i}")
            with col2: e_d = st.date_input(f"終了日", key=f"end_{i}")
            date_entries.append((s_d, e_d))
        
        # フォーム内の送信ボタン
        submit = st.form_submit_button("予定を保存")
        
    # フォームの外で日程追加ボタン（Streamlitの仕様上、form内には通常のボタンが置けないため直後に配置）
    if st.session_state.date_count < 5:
        if st.button("＋ 日程を追加"):
            st.session_state.date_count += 1
            st.rerun()

    if submit:
        if gym_name and insta_url:
            new_rows = []
            for s, e in date_entries:
                new_rows.append({
                    "gym_name": gym_name,
                    "date": s.isoformat(),
                    "end_date": e.isoformat(),
                    "url": insta_url,
                    "wall": ""
                })
            updated_df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
            conn.update(data=updated_df)
            st.session_state.date_count = 1 # カウントをリセット
            st.success("保存しました")
            st.rerun()

# --- タイムライン表示 ---
current_month_str = datetime.now().strftime('%Y年%m月')

if df is None or df.empty:
    st.info("予定がありません。上の「＋ 登録」から追加してください。")
else:
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    today = pd.to_datetime(datetime.now().date())
    df['month_year'] = df['date'].dt.strftime('%Y年%m月')

    # 月別リスト
    all_months = sorted(df['month_year'].unique().tolist())
    if current_month_str not in all_months:
        all_months.append(current_month_str)
        all_months.sort()

    # --- 月選択 UI（選びやすいセレクトボックスに変更） ---
    selected_month = st.selectbox("表示月を切り替え", options=all_months, index=all_months.index(current_month_str))

    # フィルタリング
    month_df = df[df['month_year'] == selected_month].copy()
    
    if month_df.empty:
        st.write(f"この月の予定はまだありません。")
    else:
        month_df['is_past'] = month_df['end_date'] < today
        month_df = month_df.sort_values(by=['is_past', 'date'], ascending=[True, True])

        for _, row in month_df.iterrows():
            period = f"{row['date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}"
            wrapper_start = "<div class='past-event'>" if row['is_past'] else "<div>"
            
            with st.container(border=True):
                st.markdown(f"{wrapper_start}<div class='date-text'>🗓 {period}</div>", unsafe_allow_html=True)
                col_info, col_link = st.columns([2, 1])
                with col_info:
                    st.markdown(f"### {row['gym_name']}")
                with col_link:
                    if row['url']:
                        st.link_button("詳細確認", row['url'], use_container_width=True)
                st.markdown("</div>", unsafe_allow_html=True)
