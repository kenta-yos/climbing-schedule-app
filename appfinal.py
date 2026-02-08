import streamlit as st
from utils import apply_common_style

from streamlit_option_menu import option_menu
import pages.home as home
import pages.dashboard as dashboard
import pages.gyms as gyms
import pages.friends as friends
import pages.set as set
import pages.admin as admin

# 1. ユーザー状態の初期化 (メニュー表示判定の前にやる必要があります！)
if 'USER' not in st.session_state:
    st.session_state.USER = None

# 2. ページ定義
st.set_page_config(page_title="Go Bouldering Pro", page_icon="🧗", layout="centered", initial_sidebar_state="auto")
apply_common_style()

# 上部ナビゲーションメニュー
selected = option_menu(
    menu_title=None, 
    options=["Home", "ダッシュボード", "ジム", "仲間", "セット", "管理"], 
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

if st.session_state.USER is None:
    # ログイン前
    pages_list = [st.Page("pages/home.py", title="Home", icon="🏠")]
else:
    # ログイン後
    # option_menu の選択(selected)に合わせて表示するファイルを決める
    page_map = {
        "Home": "pages/home.py",
        "ダッシュボード": "pages/dashboard.py",
        "ジム": "pages/gyms.py",
        "仲間": "pages/friends.py",
        "セット": "pages/set.py",
        "管理": "pages/admin.py"
    }
    # 選択されたページを st.Page にして実行
    pages_list = [st.Page(page_map[selected])]

# 3. トースト通知の処理
if "toast_msg" in st.session_state:
    st.toast(st.session_state.toast_msg)
    del st.session_state.toast_msg

# 4. ナビゲーションの実行
pg = st.navigation(pages_list, position="hidden") # 標準サイドバーは隠す
pg.run()

