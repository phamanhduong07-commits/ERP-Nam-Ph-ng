"""
Tool thu thập thông tin khách hàng tiềm năng từ internet (B2B Lead Crawler)
Dành cho Công ty Bao Bì Nam Phương.
Tìm kiếm các doanh nghiệp có nhu cầu thùng carton (Sản xuất, Thực phẩm, Xuất khẩu, Logistics...)
"""

import os
import re
import time
import urllib.parse
import json
import pandas as pd
from bs4 import BeautifulSoup
import requests

# Cấu hình danh sách User-Agent giả lập trình duyệt để tránh bị chặn
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.google.com/"
}


class B2BLeadCrawler:
    def __init__(self, output_dir: str = "./leads"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def search_serpapi_leads(self, query: str, api_key: str, num_results: int = 20) -> list[dict]:
        """
        Tìm kiếm doanh nghiệp bằng SerpAPI (Google Search API) tránh bị chặn IP/CAPTCHA
        """
        leads = []
        print(f"\n🔍 [SerpAPI] Đang tìm kiếm với từ khóa: '{query}'...")
        url = "https://serpapi.com/search"
        params = {
            "engine": "google",
            "q": query,
            "api_key": api_key,
            "num": num_results,
            "hl": "vi",
            "gl": "vn"
        }
        
        try:
            response = self.session.get(url, params=params, timeout=15)
            if response.status_code != 200:
                print(f"⚠️ SerpAPI trả về mã lỗi: {response.status_code}")
                return []
                
            data = response.json()
            results = data.get("organic_results", [])
            
            for result in results:
                title = result.get("title", "")
                link = result.get("link", "")
                snippet = result.get("snippet", "")
                
                if title and link:
                    # Lọc bỏ các domain không liên quan
                    skip_domains = ["facebook.com", "youtube.com", "shopee.vn", "lazada.vn", "tiki.vn", "wikipedia.org", "google.com", "gov.vn"]
                    if any(domain in link for domain in skip_domains):
                        continue
                        
                    phone = self.extract_phone_number(snippet)
                    leads.append({
                        "ten_viet_tat": self.clean_company_name(title),
                        "ten_don_vi": title,
                        "dien_thoai": phone,
                        "website": link,
                        "dia_chi": "Đang xác minh (Xem trên website)",
                        "ghi_chu": f"Tìm thấy qua SerpAPI: {snippet[:150]}..."
                    })
                    
        except Exception as e:
            print(f"❌ Lỗi khi gọi SerpAPI: {str(e)}")
            
        return leads

    def search_google_leads(self, query: str, num_pages: int = 3, api_key: str = "") -> list[dict]:
        """
        Tìm kiếm Google các trang web doanh nghiệp theo từ khóa mục tiêu.
        Nếu cấu hình api_key, sẽ tự động dùng SerpAPI để đạt hiệu năng tối ưu và tránh bị chặn.
        """
        if api_key:
            return self.search_serpapi_leads(query, api_key, num_results=num_pages * 10)

        leads = []
        print(f"\n🔍 [Scraping] Đang quét Google trực tiếp với từ khóa: '{query}'...")
        
        for page in range(num_pages):
            start = page * 10
            url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&start={start}"
            
            try:
                response = self.session.get(url, timeout=10)
                if response.status_code != 200:
                    print(f"⚠️ Không thể truy cập Google (Mã lỗi: {response.status_code})")
                    break
                
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Tìm các khối kết quả tìm kiếm của Google
                search_results = soup.select(".g")
                for result in search_results:
                    title_elem = result.select_one("h3")
                    link_elem = result.select_one("a")
                    snippet_elem = result.select_one(".VwiC3b")
                    
                    if title_elem and link_elem:
                        title = title_elem.text
                        link = link_elem["href"]
                        snippet = snippet_elem.text if snippet_elem else ""
                        
                        # Chỉ lấy các trang web doanh nghiệp thực tế, bỏ qua các trang lớn không liên quan
                        skip_domains = ["facebook.com", "youtube.com", "shopee.vn", "lazada.vn", "tiki.vn", "wikipedia.org", "google.com", "gov.vn"]
                        if any(domain in link for domain in skip_domains):
                            continue
                            
                        # Thử phân tích số điện thoại trực tiếp từ dòng mô tả của Google
                        phone = self.extract_phone_number(snippet)
                        
                        leads.append({
                            "ten_viet_tat": self.clean_company_name(title),
                            "ten_don_vi": title,
                            "dien_thoai": phone,
                            "website": link,
                            "dia_chi": "Đang xác minh (Xem trên website)",
                            "ghi_chu": f"Tìm thấy qua Google: {snippet[:150]}..."
                        })
                
                # Tránh gửi request quá nhanh
                time.sleep(2)
                
            except Exception as e:
                print(f"❌ Lỗi khi quét trang {page + 1}: {str(e)}")
                time.sleep(5)
                
        return leads

    def extract_phone_number(self, text: str) -> str:
        """Trích xuất số điện thoại Việt Nam từ đoạn text"""
        pattern = r"\b(0[35789]\d{8}|02\d{8,9})\b"
        match = re.search(pattern, text.replace(".", "").replace(" ", "").replace("-", ""))
        if match:
            # Định dạng lại số điện thoại cho đẹp
            phone = match.group(0)
            if len(phone) == 10:
                return f"{phone[:4]} {phone[4:7]} {phone[7:]}"
            return phone
        return ""

    def clean_company_name(self, title: str) -> str:
        """Chuẩn hóa tên viết tắt từ tiêu đề website"""
        name = title.split("-")[0].split("|")[0].split("—")[0].strip()
        # Loại bỏ các tiền tố dài dòng
        name = re.sub(r'^(Trang chủ|Giới thiệu|Công ty|TNHH|CP|Công ty TNHH|Công ty Cổ phần)\s+', '', name, flags=re.IGNORECASE)
        return name[:50].strip()

    def deep_crawl_lead_website(self, lead: dict) -> dict:
        """
        Truy cập trực tiếp vào website của doanh nghiệp tìm được
        để trích xuất Địa chỉ, Số điện thoại chính xác và Mã số thuế
        """
        url = lead["website"]
        print(f"🌐 Đang quét sâu website: {url}...")
        try:
            # Thử quét trang chủ và trang liên hệ
            response = self.session.get(url, timeout=8)
            soup = BeautifulSoup(response.text, "html.parser")
            page_text = soup.get_text()
            
            # 1. Tìm số điện thoại
            phone = self.extract_phone_number(page_text)
            if phone:
                lead["dien_thoai"] = phone
                
            # 2. Tìm mã số thuế
            mst_pattern = r"\b\d{10}\b|\b\d{10}-\d{3}\b"
            mst_match = re.search(mst_pattern, page_text)
            if mst_match:
                lead["ma_so_thue"] = mst_match.group(0)
                
            # 3. Tìm địa chỉ (Quét các thẻ chứa từ khóa địa chỉ)
            address_keywords = ["địa chỉ", "trụ sở", "văn phòng", "nhà máy", "xưởng", "address"]
            for elem in soup.find_all(["p", "div", "span", "footer"]):
                text = elem.text.strip()
                if any(kw in text.lower() for kw in address_keywords) and len(text) < 200 and len(text) > 20:
                    lead["dia_chi"] = text.replace("\n", " ").strip()
                    break
                    
        except Exception as e:
            print(f"⚠️ Không thể quét sâu website {url}: {str(e)}")
            
        return lead

    def export_to_excel(self, leads: list[dict], filename: str = "danh_sach_khach_hang_internet.xlsx"):
        """Xuất danh sách ra file Excel"""
        if not leads:
            print("⚠️ Không có dữ liệu để xuất file.")
            return
            
        filepath = os.path.join(self.output_dir, filename)
        df = pd.DataFrame(leads)
        df.to_excel(filepath, index=False)
        print(f"📊 Đã xuất {len(leads)} khách hàng tiềm năng thành công ra file: {os.path.abspath(filepath)}")


# Demo chạy thử nghiệm
if __name__ == "__main__":
    # Import settings từ app config nếu chạy trong môi trường app
    try:
        from app.config import settings
        api_key = settings.SERPAPI_KEY
    except ImportError:
        api_key = os.getenv("SERPAPI_KEY", "")

    crawler = B2BLeadCrawler(output_dir="./uploads/crawler")
    
    # Từ khóa mục tiêu cho doanh nghiệp cần mua thùng carton (Ví dụ: Sản xuất thực phẩm, may mặc tại Bình Dương)
    target_query = "công ty sản xuất thực phẩm bình dương"
    
    # Bước 1: Quét Google (tự động dùng SerpAPI nếu có api_key)
    raw_leads = crawler.search_google_leads(target_query, num_pages=2, api_key=api_key)
    
    # Bước 2: Quét sâu để lấy thông tin chi tiết từ các website
    detailed_leads = []
    for lead in raw_leads[:5]:  # Chạy thử 5 website để tránh nghẽn
        detailed_lead = crawler.deep_crawl_lead_website(lead)
        detailed_leads.append(detailed_lead)
        time.sleep(2) # Giãn cách
        
    # Bước 3: Xuất Excel
    crawler.export_to_excel(detailed_leads)
