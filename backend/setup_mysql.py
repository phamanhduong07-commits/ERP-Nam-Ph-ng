import pymysql
conn = pymysql.connect(host="localhost", port=3306, user="root", password="", charset="utf8mb4")
cursor = conn.cursor()
cursor.execute("CREATE DATABASE IF NOT EXISTS erp_nam_phuong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
cursor.execute("SHOW DATABASES")
dbs = [r[0] for r in cursor.fetchall() if "erp" in r[0]]
print("ERP databases:", dbs)
conn.close()
print("Done!")
