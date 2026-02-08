import streamlit as st
import pandas as pd
# utils.py から必要な機能をインポート
from utils import get_supabase_data, safe_save, init_connection

def show_page:
    # --- 初期定義 (元のコードそのまま) ---
    gym_df = get_supabase_data("gym_master")
    area_master = get_supabase_data("area_master")
    sched_df = get_supabase_data("set_schedules")
    log_df = get_supabase_data("climbing_logs")
    user_df = get_supabase_data("users")
    area_master = get_supabase_data("area_master")

    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "⚙️ 管理"    
    
    # データの準備（エリア情報を付与したジムリストを作成）
    if not gym_df.empty and not area_master.empty:
        # gym_df と area_master を area_tag で結合
        m_gyms_admin = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
        # 表示順を整える
        custom_order = ["都内・神奈川", "関東", "関西", "全国"]
        actual_areas = [a for a in m_gyms_admin['major_area'].unique() if pd.notna(a)]
        all_areas_admin = [a for a in custom_order if a in actual_areas]
        all_areas_admin += [a for a in actual_areas if a not in custom_order]
    else:
        m_gyms_admin = pd.DataFrame()
        all_areas_admin = []
    
    # --- 🆕 ジム登録 ---
    with st.expander("🆕 ジムの新規登録"):
        with st.form("adm_gym", clear_on_submit=True):
            n = st.text_input("ジム名（例: B-PUMP Ogikubo）")
            u = st.text_input("Instagram等のURL")
            
            # --- エリア選択（area_masterから動的に取得） ---
            if not area_master.empty:
                # area_tagの一覧を取得（重複排除してソート）
                area_tags = sorted(area_master['area_tag'].unique().tolist())
                a = st.radio("エリア選択", options=area_tags, horizontal=True)
            else:
                # area_masterが読み込めていない場合のフォールバック
                a = st.text_input("エリアタグ（手入力）")
                st.caption("⚠️ area_masterからデータを読み込めませんでした")
    
            if st.form_submit_button("登録"):
                if n and a:
                    new_gym = pd.DataFrame([{'gym_name': n, 'profile_url': u, 'area_tag': a}])
                    safe_save("gym_master", new_gym, mode="add", target_tab="⚙️ 管理")
                else:
                    st.warning("ジム名とエリアは必須です")
                    
    # --- 📅 2. セットスケジュール登録 ---
    with st.expander("📅 セットスケジュール登録", expanded=False):
        
        # 💡 【追加】直近1ヶ月の訪問実績を特定（管理画面用）
        recent_gyms_admin = []
        if not log_df.empty:
            one_month_ago = pd.Timestamp(today_jp) - timedelta(days=30)
            recent_gyms_admin = log_df[
                (log_df['user'] == st.session_state.USER) & 
                (log_df['type'] == '実績') & 
                (log_df['date'] >= one_month_ago)
            ]['gym_name'].unique().tolist()
    
        st.write("### 1. 対象ジムを選択")
        if not m_gyms_admin.empty:
            admin_set_tabs = st.tabs(all_areas_admin)
            
            for i, area in enumerate(all_areas_admin):
                with admin_set_tabs[i]:
                    raw_area_gyms = sorted(m_gyms_admin[m_gyms_admin['major_area'] == area]['gym_name'].unique().tolist())
                    
                    if raw_area_gyms:
                        # 💡 表示用ラベルの作成
                        display_options_admin = []
                        label_map_admin = {}
                        
                        for g_name in raw_area_gyms:
                            if g_name in recent_gyms_admin:
                                label = f"{g_name} 🌟"
                            else:
                                label = f"{g_name}"
                            display_options_admin.append(label)
                            label_map_admin[label] = g_name
    
                        st.radio(
                            f"{area}のジムを選択",
                            options=display_options_admin,
                            index=None,
                            key=f"radio_admin_set_{area}",
                            label_visibility="collapsed"
                        )
        else:
            st.error("ジムデータが読み込めません。")
        
        st.divider()
        st.write("### 2. セット日程とURLを入力")
    
        # 💡 改善2: 「追加」ボタンと「フォーム」を一つの枠内に配置
        if "rows" not in st.session_state: 
            st.session_state.rows = 1
        
        # フォーム開始
        with st.form("admin_schedule_form_ux_fix", clear_on_submit=True):
            p_url_set = st.text_input("告知URL (Instagramなど)", key="set_final_post_url")
            
            d_list = []
            for i in range(st.session_state.rows):
                c1, c2 = st.columns(2)
                sd = c1.date_input(f"開始 {i+1}", value=today_jp, key=f"sd_v4_{i}")
                ed = c2.date_input(f"終了 {i+1}", value=today_jp, key=f"ed_v4_{i}")
                d_list.append((sd, ed))
    
            # フォーム内の登録ボタン
            submit_button = st.form_submit_button("上記の内容で一括登録", use_container_width=True)
            
            if submit_button:
                if selected_gym_set and p_url_set:
                    new_s_list = []
                    for d in d_list:
                        new_s_list.append({
                            'gym_name': selected_gym_set,
                            'start_date': d[0].isoformat(),
                            'end_date': d[1].isoformat(),
                            'post_url': p_url_set
                        })
                    
                    new_s_df = pd.DataFrame(new_s_list)
                    st.session_state.rows = 1 
                    # ラジオボタンリセット
                    for area in all_areas_admin:
                        if f"radio_admin_set_{area}" in st.session_state:
                            del st.session_state[f"radio_admin_set_{area}"]
                    
                    safe_save("set_schedules", new_s_df, mode="add", target_tab="📅 セット")
                else:
                    st.error("ジムの選択と告知URLの入力は必須です。")
    
        # 💡 「追加」ボタンを expander の中、かつフォームのすぐ下に配置
        # これにより、見た目上はセットスケジュール登録機能の一部としてまとまります
        if st.button("➕ 日程入力欄を増やす", key="btn_add_row_ux_fix"): 
            st.session_state.rows += 1
            st.rerun()
            
    # --- 🚪 3. ログアウト ---
    st.divider()
    if st.button("🚪 ログアウト", use_container_width=True): 
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
