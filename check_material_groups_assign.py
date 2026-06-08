import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
from dotenv import load_dotenv; load_dotenv('.env')
from app.config import settings; os.chdir('..')
from sqlalchemy import create_engine, text

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as pg:
    print('=== other_materials theo nhom ===')
    rows = pg.execute(text('''
        SELECT mg.ma_nhom, mg.ten_nhom, COUNT(om.id) as cnt
        FROM material_groups mg
        LEFT JOIN other_materials om ON om.ma_nhom_id = mg.id
        GROUP BY mg.id, mg.ma_nhom, mg.ten_nhom
        ORDER BY cnt DESC
    ''')).fetchall()
    for r in rows:
        bar = r[2] if r[2] else 0
        print(f'  {str(r[0]):20s} | {str(r[1]):30s} | {bar:>5}')

    no_group = pg.execute(text('SELECT COUNT(*) FROM other_materials WHERE ma_nhom_id IS NULL')).scalar()
    total = pg.execute(text('SELECT COUNT(*) FROM other_materials')).scalar()
    print(f'  {"(chua co nhom)":20s} |                                | {no_group:>5}')
    print(f'  TOTAL: {total}')

    print()
    print('=== paper_materials theo nhom ===')
    rows2 = pg.execute(text('''
        SELECT mg.ma_nhom, mg.ten_nhom, COUNT(pm.id) as cnt
        FROM material_groups mg
        LEFT JOIN paper_materials pm ON pm.ma_nhom_id = mg.id
        GROUP BY mg.id, mg.ma_nhom, mg.ten_nhom
        ORDER BY cnt DESC
    ''')).fetchall()
    for r in rows2:
        if r[2] > 0:
            print(f'  {str(r[0]):20s} | {str(r[1]):30s} | {r[2]:>5}')

    no_group2 = pg.execute(text('SELECT COUNT(*) FROM paper_materials WHERE ma_nhom_id IS NULL')).scalar()
    total2 = pg.execute(text('SELECT COUNT(*) FROM paper_materials')).scalar()
    print(f'  {"(chua co nhom)":20s} |                                | {no_group2:>5}')
    print(f'  TOTAL: {total2}')
