import streamlit as st
from utils import apply_common_style
from utils import get_supabase_data
import base64

from streamlit_option_menu import option_menu
import pages.home as home
import pages.dashboard as dashboard
import pages.gyms as gyms
import pages.set as set
import pages.admin as admin

# ページ定義
st.set_page_config(page_title="Go Bouldering Pro", page_icon="icon.png", layout="centered", initial_sidebar_state="auto")
apply_common_style()

# --- ホーム画面用アイコン設定 ---
def set_home_icon(path):
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    st.markdown(f"""
        <link rel="apple-touch-icon" sizes="180x180" href="data:image/png;base64,{data}">
        <link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,{data}">
        <link rel="icon" type="image/png" sizes="16x16" href="data:image/png;base64,{data}">
    """, unsafe_allow_html=True)

set_home_icon("icon.png")

# --- URL パラメータからログイン自動復元 ---
if "USER" not in st.session_state or st.session_state.USER is None:
    url_user = st.query_params.get("user", [None])[0]  # 注意: listなので[0]で取得
    if url_user:
        user_df = get_supabase_data("users")
        user_info = user_df[user_df['user_name'] == url_user]
        if not user_info.empty:
            row = user_info.iloc[0]
            st.session_state.USER = row['user_name']
            st.session_state.U_COLOR = row['color']
            st.session_state.U_ICON = row['icon']

# --- USER がまだなければ None で初期化 ---
if "USER" not in st.session_state:
    st.session_state.USER = None

# --- 2. ログイン判定による分岐 ---
if st.session_state.USER is None:
    # A. ログイン前：メニューを表示せず、即座に home.py のログイン画面を表示
    home.show_page()

else:
    # B. ログイン後：ここで初めてメニューを表示する
    from streamlit_option_menu import option_menu
    import pages.dashboard as dashboard
    import pages.gyms as gyms
    import pages.set as set
    import pages.admin as admin

    selected = option_menu(
        menu_title=None, 
        options=["トップ", "ログ", "ジム", "セット", "管理"], 
        icons=["house", "bar-chart", "grid", "calendar", "gear"], 
        orientation="horizontal",
    styles={
                "container": {"padding": "0!important", "background-color": "#fafafa"},
                "icon": {
                    "margin": "0",             # アイコンの余白をリセット
                    "padding": "0",
                    "font-size": "1.2rem",     # アイコンサイズ（適宜調整）
                },
                "nav-link": {
                    "font-size": "11px",       # 文字サイズ
                    "font-weight": "bold",     # 太字
                    "display": "flex", 
                    "flex-direction": "column",# アイコンと文字を縦に並べて中央揃え
                    "align-items": "center", 
                    "justify-content": "center",
                    "text-align": "center",
                    "padding": "10px 0px",     # 上下の余白
                    "margin": "0px",
                    "width": "100%",           # 幅いっぱい
                    "--hover-color": "#eee"
                },
                "nav-link-selected": {"background-color": "#FF512F"},
            }
        )
    # 選択されたページを呼び出す
    if selected == "トップ":
        home.show_page()
    elif selected == "ログ":
        dashboard.show_page()
    elif selected == "ジム":
        gyms.show_page()
    elif selected == "セット":
        set.show_page()
    elif selected == "管理":
        admin.show_page()

st.write("") 
st.write("")
# 空白をHTMLで調整（約100px程度の余白を作る）
st.markdown('<div style="margin-bottom: 100px;"></div>', unsafe_allow_html=True)

# 3. トースト通知の処理
if "toast_msg" in st.session_state:
    st.toast(st.session_state.toast_msg)
    del st.session_state.toast_msg
