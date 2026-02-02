import streamlit as st
from streamlit_gsheets import GSheetsConnection
import pandas as pd
from datetime import datetime

# ページ設定
st.set_page_config(page_title="セットスケジュール", layout="centered")

# --- カスタムCSS（日本語バランス & グレーアウト設定） ---
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
    /* 過去の予定（グレーアウト）用のスタイル */
    .past-event {
        opacity: 0.5;
        filter: grayscale(1);
    }
    h1 { font-size: 1.6rem !important; font-weight: 700 !important; }
    h3 { font-size: 1.15rem !important; font-weight: 600 !important; margin: 0 !important; }
    .date-text {
        font-size: 0.95rem; /* 日付を少し大きく調整 */
        font-weight: 700;
        color: #555;
        margin-bottom: 0.5rem;
    }
    </style>
    """, unsafe_allow_html=True)

# --- スプレッドシート接続 ---
conn = st.connection("gsheets", type=GSheetsConnection)
df = conn.read(ttl=0)

st.title("🧗‍♂️ セットスケジュール")

# --- 登録セクション ---
with st.expander("＋ 登録", expanded=False):
    with st.form("add_form", clear_on_submit=True):
        gym_name = st.text_input("ジム名")
        col1, col2 = st.columns(2)
        with col1: start_d = st.date_input("セット開始日")
        with col2: end_d = st.date_input("セット終了日")
        insta_url = st.text_input("Instagram URL")
        
        if st.form_submit_button("予定を保存"):
            if gym_name and insta_url:
                new_entry = pd.DataFrame([{"gym_name": gym_name, "date": start_d.isoformat(), "end_date": end_d.isoformat(), "url": insta_url, "wall": ""}])
                conn.update(data=pd.concat([df, new_entry], ignore_index=True))
                st.success("保存しました")
                st.rerun()

# --- タイムライン表示 ---
if df.empty:
    st.info("予定がありません。")
else:
    # データ型変換
    df['date'] = pd.to_datetime(df['date'])
    df['end_date'] = pd.to_datetime(df['end_date'])
    today = pd.to_datetime(datetime.now().date())

    # --- 月別タブの作成 ---
    # 登録されているデータの「月」をユニークに取得（今月を含む）
    df['month_year'] = df['date'].dt.strftime('%Y年%m月')
    all_months = sorted(df['month_year'].unique())
    current_month_str = datetime.now().strftime('%Y年%m月')
    
    if current_month_str not in all_months:
        all_months.append(current_month_str)
        all_months.sort()

    # 月選択のタブ
    selected_month = st.select_slider("表示月を選択", options=all_months, value=current_month_str)

    # 選択された月のデータを抽出
    month_df = df[df['month_year'] == selected_month].copy()
    
    if month_df.empty:
        st.write(f"### {selected_month} の予定はありません")
    else:
        # 過去かどうかのフラグを作成（終了日が昨日以前なら過去）
        month_df['is_past'] = month_df['end_date'] < today
        
        # 昇順ソート（過去フラグを第1キーにすることで、過去分[True=1]が下に来る）
        month_df = month_df.sort_values(by=['is_past', 'date'], ascending=[True, True])

        for _, row in month_df.iterrows():
            period = f"{row['date'].strftime('%m/%d')} — {row['end_date'].strftime('%m/%d')}"
            
            # 過去の場合は全体をグレーアウトさせるHTMLを仕込む
            wrapper_start = "<div class='past-event'>" if row['is_past'] else "<div>"
            wrapper_end = "</div>"
            
            with st.container(border=True):
                st.markdown(f"{wrapper_start}<div class='date-text'>🗓 {period}</div>", unsafe_allow_html=True)
                
                col_info, col_link = st.columns([2, 1])
                with col_info:
                    st.markdown(f"### {row['gym_name']}")
                with col_link:
                    if row['url']:
                        st.link_button("詳細確認", row['url'], use_container_width=True)
                st.markdown(wrapper_end, unsafe_allow_html=True)
