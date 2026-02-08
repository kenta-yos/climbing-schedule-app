import streamlit as st
from utils import apply_common_style

# 1. ページ設定（このファイルで一度だけ実行）
st.set_page_config(page_title="Go Bouldering Pro", page_icon="🧗", layout="centered", initial_sidebar_state="collapsed")
apply_common_style()

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
    pg = st.navigation([st.Page("pages/home.py", title="Go Bouldering", icon="🧗")])
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
