import streamlit as st
import pandas as pd
# utils.py から必要な機能をインポート
from utils import get_supabase_data, safe_save, init_connection, get_now_jp

def show_page(log_df, user_df, gym_df, sched_df):
    # 修正ポイント2: today_jp の定義（utilsから取得）
    now_jp = get_now_jp()
    today_jp = now_jp.date()
    
    area_master = get_supabase_data("area_master")

    # 未ログイン時のガード
    if st.session_state.USER is None:
        st.warning("ログインしてください")
        st.stop()
    
    st.query_params["tab"] = "⚙️ 管理"    
    
    # データの準備（エリア情報を付与したジムリストを作成）
    if not gym_df.empty and not area_master.empty:
        m_gyms_admin = pd.merge(gym_df, area_master[['area_tag', 'major_area']], on='area_tag', how='left')
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
            
            if not area_master.empty:
                area_tags = sorted(area_master['area_tag'].unique().tolist())
                a = st.radio("エリア選択", options=area_tags, horizontal=True)
            else:
                a = st.text_input("エリアタグ（手入力）")
    
            if st.form_submit_button("登録"):
                if n and a:
                    new_gym = pd.DataFrame([{'gym_name': n, 'profile_url': u, 'area_tag': a}])
                    safe_save("gym_master", new_gym, mode="add", target_tab="⚙️ 管理")
                else:
                    st.warning("ジム名とエリアは必須です")
                    
    # --- 📅 2. セットスケジュール登録 ---
    with st.expander("📅 セットスケジュール登録", expanded=False):
        recent_gyms_admin = []
        if not log_df.empty:
            # 修正ポイント3: today_jp を Timestamp に変換して計算
            one_month_ago = pd.Timestamp(today_jp) - timedelta(days=30)
            recent_gyms_admin = log_df[
                (log_df['user'] == st.session_state.USER) & 
                (log_df['type'] == '実績') & 
                (log_df['date'] >= one_month_ago)
            ]['gym_name'].unique().tolist()
    
        st.write("### 1. 対象ジムを選択")
        selected_gym_set = None # 選択されたジムを格納する変数
        
        if not m_gyms_admin.empty:
            admin_set_tabs = st.tabs(all_areas_admin)
            for i, area in enumerate(all_areas_admin):
                with admin_set_tabs[i]:
                    raw_area_gyms = sorted(m_gyms_admin[m_gyms_admin['major_area'] == area]['gym_name'].unique().tolist())
                    if raw_area_gyms:
                        display_options_admin = []
                        label_map_admin = {}
                        for g_name in raw_area_gyms:
                            label = f"{g_name} 🌟" if g_name in recent_gyms_admin else f"{g_name}"
                            display_options_admin.append(label)
                            label_map_admin[label] = g_name
    
                        # 修正ポイント4: 選択結果を selected_gym_set に入れる
                        res = st.radio(
                            f"{area}のジムを選択",
                            options=display_options_admin,
                            index=None,
                            key=f"radio_admin_set_{area}",
                            label_visibility="collapsed"
                        )
                        if res:
                            selected_gym_set = label_map_admin[res]
        else:
            st.error("ジムデータが読み込めません。")
        
        st.divider()
        st.write("### 2. セット日程とURLを入力")
    
        if "rows" not in st.session_state: 
            st.session_state.rows = 1
        
        with st.form("admin_schedule_form_ux_fix", clear_on_submit=True):
            p_url_set = st.text_input("告知URL (Instagramなど)", key="set_final_post_url")
            d_list = []
            for i in range(st.session_state.rows):
                c1, c2 = st.columns(2)
                sd = c1.date_input(f"開始 {i+1}", value=today_jp, key=f"sd_v4_{i}")
                ed = c2.date_input(f"終了 {i+1}", value=today_jp, key=f"ed_v4_{i}")
                d_list.append((sd, ed))
    
            submit_button = st.form_submit_button("上記の内容で一括登録", use_container_width=True)
            
            if submit_button:
                # 修正ポイント5: selected_gym_set が選ばれているか確認
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
                    safe_save("set_schedules", new_s_df, mode="add", target_tab="📅 セット")
                else:
                    st.error("ジムの選択と告知URLの入力は必須です。")
    
        if st.button("➕ 日程入力欄を増やす", key="btn_add_row_ux_fix"): 
            st.session_state.rows += 1
            st.rerun()
            
    st.divider()
    if st.button("🚪 ログアウト", use_container_width=True): 
        st.session_state.USER = None
        st.query_params.clear()
        st.rerun()
