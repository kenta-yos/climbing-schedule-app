import streamlit as st
from utils import apply_common_style

from streamlit_option_menu import option_menu
import pages.home as home
import pages.dashboard as dashboard
import pages.gyms as gyms
import pages.friends as friends
import pages.set as set
import pages.admin as admin

# 1. ページ設定（このファイルで一度だけ実行）
st.set_page_config(page_title="Go Bouldering Pro", page_icon="🧗", layout="centered", initial_sidebar_state="auto")
apply_common_style()

# 上部ナビゲーションメニュー
selected = option_menu(
    menu_title=None, 
    options=["🏠", "📊", "🎲", "🫶", "📅", "⚙️"], 
    icons=["🏠", "📊", "🎲", "🫶", "📅", "⚙️"], 
    menu_icon="cast", 
    default_index=0, 
    orientation="horizontal",
    styles={
        "container": {"padding": "0!important", "background-color": "#fafafa"},
        "icon": {"color": "#FF512F", "font-size": "20px"}, 
        "nav-link": {"font-size": "16px", "text-align": "center", "margin":"0px", "--hover-color": "#eee"},
        "nav-link-selected": {"background-color": "#FF512F", "color": "white"},
    }
)

# 選択されたメニューに応じて表示を切り替える
if selected == "Home":
    home.show_page()
elif selected == "ダッシュボード":
    dashboard.show_page()
elif selected == "ジム":
    gyms.show_page()
elif selected == "仲間":
    friends.show_page()
elif selected == "セット":
    set.show_page()
elif selected == "管理":
    admin.show_page()

# 2. セッション状態の初期化
if 'USER' not in st.session_state:
    st.session_state.USER = None

# 3. トースト通知の処理
if "toast_msg" in st.session_state:
    st.toast(st.session_state.toast_msg)
    del st.session_state.toast_msg

# 4. ナビゲーションの定義
if st.session_state.USER is None:
    # ログインしていない時はログイン画面(home.py)のみ
    pg = st.navigation([st.Page("pages/home.py", title="Go Bouldering", icon="🧗")], position="hidden")
else:
    # ログイン後は全メニューを表示
    pg = st.navigation([
        st.Page("pages/home.py", title="Home", icon="🏠"),
        st.Page("pages/dashboard.py", title="ダッシュボード", icon="📊"),
        st.Page("pages/gyms.py", title="ジム", icon="🎲"),
        st.Page("pages/friends.py", title="仲間", icon="🫶"),
        st.Page("pages/set.py", title="セット", icon="📅"),
        st.Page("pages/admin.py", title="管理", icon="⚙️"),
    ], position="top")

# 5. 実行
pg.run()
