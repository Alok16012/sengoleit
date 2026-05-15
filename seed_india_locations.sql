-- ============================================================
-- INDIA STATES AND DISTRICTS SEED
-- All 28 States + 8 Union Territories + All Districts
-- Safe to run multiple times (ON CONFLICT DO NOTHING)
-- ============================================================

-- Make sure India exists
INSERT INTO countries (country_name, country_code) VALUES ('India', 'IN') ON CONFLICT DO NOTHING;

-- ============================================================
-- INSERT ALL STATES & UNION TERRITORIES
-- ============================================================
INSERT INTO states (state_name, country_id)
SELECT s.state_name, c.id FROM countries c, (VALUES
  ('Andhra Pradesh'),('Arunachal Pradesh'),('Assam'),('Bihar'),
  ('Chhattisgarh'),('Goa'),('Gujarat'),('Haryana'),
  ('Himachal Pradesh'),('Jharkhand'),('Karnataka'),('Kerala'),
  ('Madhya Pradesh'),('Maharashtra'),('Manipur'),('Meghalaya'),
  ('Mizoram'),('Nagaland'),('Odisha'),('Punjab'),
  ('Rajasthan'),('Sikkim'),('Tamil Nadu'),('Telangana'),
  ('Tripura'),('Uttar Pradesh'),('Uttarakhand'),('West Bengal'),
  ('Andaman and Nicobar Islands'),('Chandigarh'),
  ('Dadra and Nagar Haveli and Daman and Diu'),
  ('Delhi'),('Jammu and Kashmir'),('Ladakh'),
  ('Lakshadweep'),('Puducherry')
) AS s(state_name)
WHERE c.country_code = 'IN'
ON CONFLICT DO NOTHING;

-- CTE to get ONE unique id per state name (avoids duplicate state error)
WITH unique_states AS (
  SELECT DISTINCT ON (state_name) id, state_name FROM states ORDER BY state_name, created_at
)

-- ============================================================
-- ALL DISTRICTS IN ONE QUERY USING CTE
-- ============================================================
INSERT INTO districts (district_name, state_id)
SELECT d.district_name, us.id
FROM unique_states us
JOIN (VALUES
  -- Andhra Pradesh
  ('Alluri Sitharama Raju','Andhra Pradesh'),('Anakapalli','Andhra Pradesh'),('Ananthapuramu','Andhra Pradesh'),
  ('Annamayya','Andhra Pradesh'),('Bapatla','Andhra Pradesh'),('Chittoor','Andhra Pradesh'),
  ('Dr. B.R. Ambedkar Konaseema','Andhra Pradesh'),('East Godavari','Andhra Pradesh'),
  ('Eluru','Andhra Pradesh'),('Guntur','Andhra Pradesh'),('Kakinada','Andhra Pradesh'),
  ('Krishna','Andhra Pradesh'),('Kurnool','Andhra Pradesh'),('Nandyal','Andhra Pradesh'),
  ('NTR','Andhra Pradesh'),('Palnadu','Andhra Pradesh'),('Parvathipuram Manyam','Andhra Pradesh'),
  ('Prakasam','Andhra Pradesh'),('Sri Potti Sriramulu Nellore','Andhra Pradesh'),
  ('Sri Sathya Sai','Andhra Pradesh'),('Srikakulam','Andhra Pradesh'),('Tirupati','Andhra Pradesh'),
  ('Visakhapatnam','Andhra Pradesh'),('Vizianagaram','Andhra Pradesh'),
  ('West Godavari','Andhra Pradesh'),('YSR Kadapa','Andhra Pradesh'),
  -- Arunachal Pradesh
  ('Anjaw','Arunachal Pradesh'),('Changlang','Arunachal Pradesh'),('Dibang Valley','Arunachal Pradesh'),
  ('East Kameng','Arunachal Pradesh'),('East Siang','Arunachal Pradesh'),
  ('Itanagar Capital Complex','Arunachal Pradesh'),('Kamle','Arunachal Pradesh'),
  ('Kra Daadi','Arunachal Pradesh'),('Kurung Kumey','Arunachal Pradesh'),
  ('Lepa Rada','Arunachal Pradesh'),('Lohit','Arunachal Pradesh'),('Longding','Arunachal Pradesh'),
  ('Lower Dibang Valley','Arunachal Pradesh'),('Lower Siang','Arunachal Pradesh'),
  ('Lower Subansiri','Arunachal Pradesh'),('Namsai','Arunachal Pradesh'),
  ('Pakke Kessang','Arunachal Pradesh'),('Papum Pare','Arunachal Pradesh'),
  ('Shi Yomi','Arunachal Pradesh'),('Siang','Arunachal Pradesh'),('Tawang','Arunachal Pradesh'),
  ('Tirap','Arunachal Pradesh'),('Upper Siang','Arunachal Pradesh'),
  ('Upper Subansiri','Arunachal Pradesh'),('West Kameng','Arunachal Pradesh'),
  ('West Siang','Arunachal Pradesh'),
  -- Assam
  ('Bajali','Assam'),('Baksa','Assam'),('Barpeta','Assam'),('Biswanath','Assam'),
  ('Bongaigaon','Assam'),('Cachar','Assam'),('Charaideo','Assam'),('Chirang','Assam'),
  ('Darrang','Assam'),('Dhemaji','Assam'),('Dhubri','Assam'),('Dibrugarh','Assam'),
  ('Dima Hasao','Assam'),('Goalpara','Assam'),('Golaghat','Assam'),('Hailakandi','Assam'),
  ('Hojai','Assam'),('Jorhat','Assam'),('Kamrup','Assam'),('Kamrup Metropolitan','Assam'),
  ('Karbi Anglong','Assam'),('Karimganj','Assam'),('Kokrajhar','Assam'),('Lakhimpur','Assam'),
  ('Majuli','Assam'),('Morigaon','Assam'),('Nagaon','Assam'),('Nalbari','Assam'),
  ('Sivasagar','Assam'),('Sonitpur','Assam'),('South Salmara-Mankachar','Assam'),
  ('Tamulpur','Assam'),('Tinsukia','Assam'),('Udalguri','Assam'),('West Karbi Anglong','Assam'),
  -- Bihar
  ('Araria','Bihar'),('Arwal','Bihar'),('Aurangabad','Bihar'),('Banka','Bihar'),
  ('Begusarai','Bihar'),('Bhagalpur','Bihar'),('Bhojpur','Bihar'),('Buxar','Bihar'),
  ('Darbhanga','Bihar'),('East Champaran','Bihar'),('Gaya','Bihar'),('Gopalganj','Bihar'),
  ('Jamui','Bihar'),('Jehanabad','Bihar'),('Kaimur','Bihar'),('Katihar','Bihar'),
  ('Khagaria','Bihar'),('Kishanganj','Bihar'),('Lakhisarai','Bihar'),('Madhepura','Bihar'),
  ('Madhubani','Bihar'),('Munger','Bihar'),('Muzaffarpur','Bihar'),('Nalanda','Bihar'),
  ('Nawada','Bihar'),('Patna','Bihar'),('Purnia','Bihar'),('Rohtas','Bihar'),
  ('Saharsa','Bihar'),('Samastipur','Bihar'),('Saran','Bihar'),('Sheikhpura','Bihar'),
  ('Sheohar','Bihar'),('Sitamarhi','Bihar'),('Siwan','Bihar'),('Supaul','Bihar'),
  ('Vaishali','Bihar'),('West Champaran','Bihar'),
  -- Chhattisgarh
  ('Balod','Chhattisgarh'),('Baloda Bazar','Chhattisgarh'),('Balrampur','Chhattisgarh'),
  ('Bastar','Chhattisgarh'),('Bemetara','Chhattisgarh'),('Bijapur','Chhattisgarh'),
  ('Bilaspur','Chhattisgarh'),('Dantewada','Chhattisgarh'),('Dhamtari','Chhattisgarh'),
  ('Durg','Chhattisgarh'),('Gariaband','Chhattisgarh'),('Gaurela Pendra Marwahi','Chhattisgarh'),
  ('Janjgir-Champa','Chhattisgarh'),('Jashpur','Chhattisgarh'),('Kabirdham','Chhattisgarh'),
  ('Kanker','Chhattisgarh'),('Khairagarh','Chhattisgarh'),('Kondagaon','Chhattisgarh'),
  ('Korba','Chhattisgarh'),('Koriya','Chhattisgarh'),('Mahasamund','Chhattisgarh'),
  ('Manendragarh','Chhattisgarh'),('Mohla-Manpur','Chhattisgarh'),('Mungeli','Chhattisgarh'),
  ('Narayanpur','Chhattisgarh'),('Raigarh','Chhattisgarh'),('Raipur','Chhattisgarh'),
  ('Rajnandgaon','Chhattisgarh'),('Sakti','Chhattisgarh'),('Sarangarh-Bilaigarh','Chhattisgarh'),
  ('Sukma','Chhattisgarh'),('Surajpur','Chhattisgarh'),('Surguja','Chhattisgarh'),
  -- Goa
  ('North Goa','Goa'),('South Goa','Goa'),
  -- Gujarat
  ('Ahmedabad','Gujarat'),('Amreli','Gujarat'),('Anand','Gujarat'),('Aravalli','Gujarat'),
  ('Banaskantha','Gujarat'),('Bharuch','Gujarat'),('Bhavnagar','Gujarat'),('Botad','Gujarat'),
  ('Chhota Udaipur','Gujarat'),('Dahod','Gujarat'),('Dang','Gujarat'),
  ('Devbhoomi Dwarka','Gujarat'),('Gandhinagar','Gujarat'),('Gir Somnath','Gujarat'),
  ('Jamnagar','Gujarat'),('Junagadh','Gujarat'),('Kheda','Gujarat'),('Kutch','Gujarat'),
  ('Mahisagar','Gujarat'),('Mehsana','Gujarat'),('Morbi','Gujarat'),('Narmada','Gujarat'),
  ('Navsari','Gujarat'),('Panchmahal','Gujarat'),('Patan','Gujarat'),('Porbandar','Gujarat'),
  ('Rajkot','Gujarat'),('Sabarkantha','Gujarat'),('Surat','Gujarat'),
  ('Surendranagar','Gujarat'),('Tapi','Gujarat'),('Vadodara','Gujarat'),('Valsad','Gujarat'),
  -- Haryana
  ('Ambala','Haryana'),('Bhiwani','Haryana'),('Charkhi Dadri','Haryana'),
  ('Faridabad','Haryana'),('Fatehabad','Haryana'),('Gurugram','Haryana'),
  ('Hisar','Haryana'),('Jhajjar','Haryana'),('Jind','Haryana'),('Kaithal','Haryana'),
  ('Karnal','Haryana'),('Kurukshetra','Haryana'),('Mahendragarh','Haryana'),
  ('Nuh','Haryana'),('Palwal','Haryana'),('Panchkula','Haryana'),('Panipat','Haryana'),
  ('Rewari','Haryana'),('Rohtak','Haryana'),('Sirsa','Haryana'),
  ('Sonipat','Haryana'),('Yamunanagar','Haryana'),
  -- Himachal Pradesh
  ('Bilaspur','Himachal Pradesh'),('Chamba','Himachal Pradesh'),('Hamirpur','Himachal Pradesh'),
  ('Kangra','Himachal Pradesh'),('Kinnaur','Himachal Pradesh'),('Kullu','Himachal Pradesh'),
  ('Lahaul and Spiti','Himachal Pradesh'),('Mandi','Himachal Pradesh'),
  ('Shimla','Himachal Pradesh'),('Sirmaur','Himachal Pradesh'),
  ('Solan','Himachal Pradesh'),('Una','Himachal Pradesh'),
  -- Jharkhand
  ('Bokaro','Jharkhand'),('Chatra','Jharkhand'),('Deoghar','Jharkhand'),
  ('Dhanbad','Jharkhand'),('Dumka','Jharkhand'),('East Singhbhum','Jharkhand'),
  ('Garhwa','Jharkhand'),('Giridih','Jharkhand'),('Godda','Jharkhand'),
  ('Gumla','Jharkhand'),('Hazaribagh','Jharkhand'),('Jamtara','Jharkhand'),
  ('Khunti','Jharkhand'),('Koderma','Jharkhand'),('Latehar','Jharkhand'),
  ('Lohardaga','Jharkhand'),('Pakur','Jharkhand'),('Palamu','Jharkhand'),
  ('Ramgarh','Jharkhand'),('Ranchi','Jharkhand'),('Sahebganj','Jharkhand'),
  ('Seraikela Kharsawan','Jharkhand'),('Simdega','Jharkhand'),('West Singhbhum','Jharkhand'),
  -- Karnataka
  ('Bagalkot','Karnataka'),('Ballari','Karnataka'),('Belagavi','Karnataka'),
  ('Bengaluru Rural','Karnataka'),('Bengaluru Urban','Karnataka'),('Bidar','Karnataka'),
  ('Chamarajanagar','Karnataka'),('Chikkaballapur','Karnataka'),('Chikkamagaluru','Karnataka'),
  ('Chitradurga','Karnataka'),('Dakshina Kannada','Karnataka'),('Davangere','Karnataka'),
  ('Dharwad','Karnataka'),('Gadag','Karnataka'),('Hassan','Karnataka'),('Haveri','Karnataka'),
  ('Kalaburagi','Karnataka'),('Kodagu','Karnataka'),('Kolar','Karnataka'),('Koppal','Karnataka'),
  ('Mandya','Karnataka'),('Mysuru','Karnataka'),('Raichur','Karnataka'),
  ('Ramanagara','Karnataka'),('Shivamogga','Karnataka'),('Tumakuru','Karnataka'),
  ('Udupi','Karnataka'),('Uttara Kannada','Karnataka'),('Vijayapura','Karnataka'),
  ('Yadgir','Karnataka'),
  -- Kerala
  ('Alappuzha','Kerala'),('Ernakulam','Kerala'),('Idukki','Kerala'),('Kannur','Kerala'),
  ('Kasaragod','Kerala'),('Kollam','Kerala'),('Kottayam','Kerala'),('Kozhikode','Kerala'),
  ('Malappuram','Kerala'),('Palakkad','Kerala'),('Pathanamthitta','Kerala'),
  ('Thiruvananthapuram','Kerala'),('Thrissur','Kerala'),('Wayanad','Kerala'),
  -- Madhya Pradesh
  ('Agar Malwa','Madhya Pradesh'),('Alirajpur','Madhya Pradesh'),('Anuppur','Madhya Pradesh'),
  ('Ashoknagar','Madhya Pradesh'),('Balaghat','Madhya Pradesh'),('Barwani','Madhya Pradesh'),
  ('Betul','Madhya Pradesh'),('Bhind','Madhya Pradesh'),('Bhopal','Madhya Pradesh'),
  ('Burhanpur','Madhya Pradesh'),('Chhatarpur','Madhya Pradesh'),('Chhindwara','Madhya Pradesh'),
  ('Damoh','Madhya Pradesh'),('Datia','Madhya Pradesh'),('Dewas','Madhya Pradesh'),
  ('Dhar','Madhya Pradesh'),('Dindori','Madhya Pradesh'),('Guna','Madhya Pradesh'),
  ('Gwalior','Madhya Pradesh'),('Harda','Madhya Pradesh'),('Hoshangabad','Madhya Pradesh'),
  ('Indore','Madhya Pradesh'),('Jabalpur','Madhya Pradesh'),('Jhabua','Madhya Pradesh'),
  ('Katni','Madhya Pradesh'),('Khandwa','Madhya Pradesh'),('Khargone','Madhya Pradesh'),
  ('Maihar','Madhya Pradesh'),('Mandla','Madhya Pradesh'),('Mandsaur','Madhya Pradesh'),
  ('Morena','Madhya Pradesh'),('Narsinghpur','Madhya Pradesh'),('Neemuch','Madhya Pradesh'),
  ('Niwari','Madhya Pradesh'),('Panna','Madhya Pradesh'),('Raisen','Madhya Pradesh'),
  ('Rajgarh','Madhya Pradesh'),('Ratlam','Madhya Pradesh'),('Rewa','Madhya Pradesh'),
  ('Sagar','Madhya Pradesh'),('Satna','Madhya Pradesh'),('Sehore','Madhya Pradesh'),
  ('Seoni','Madhya Pradesh'),('Shahdol','Madhya Pradesh'),('Shajapur','Madhya Pradesh'),
  ('Sheopur','Madhya Pradesh'),('Shivpuri','Madhya Pradesh'),('Sidhi','Madhya Pradesh'),
  ('Singrauli','Madhya Pradesh'),('Tikamgarh','Madhya Pradesh'),('Ujjain','Madhya Pradesh'),
  ('Umaria','Madhya Pradesh'),('Vidisha','Madhya Pradesh'),
  -- Maharashtra
  ('Ahmednagar','Maharashtra'),('Akola','Maharashtra'),('Amravati','Maharashtra'),
  ('Aurangabad','Maharashtra'),('Beed','Maharashtra'),('Bhandara','Maharashtra'),
  ('Buldhana','Maharashtra'),('Chandrapur','Maharashtra'),('Dhule','Maharashtra'),
  ('Gadchiroli','Maharashtra'),('Gondia','Maharashtra'),('Hingoli','Maharashtra'),
  ('Jalgaon','Maharashtra'),('Jalna','Maharashtra'),('Kolhapur','Maharashtra'),
  ('Latur','Maharashtra'),('Mumbai City','Maharashtra'),('Mumbai Suburban','Maharashtra'),
  ('Nagpur','Maharashtra'),('Nanded','Maharashtra'),('Nandurbar','Maharashtra'),
  ('Nashik','Maharashtra'),('Osmanabad','Maharashtra'),('Palghar','Maharashtra'),
  ('Parbhani','Maharashtra'),('Pune','Maharashtra'),('Raigad','Maharashtra'),
  ('Ratnagiri','Maharashtra'),('Sangli','Maharashtra'),('Satara','Maharashtra'),
  ('Sindhudurg','Maharashtra'),('Solapur','Maharashtra'),('Thane','Maharashtra'),
  ('Wardha','Maharashtra'),('Washim','Maharashtra'),('Yavatmal','Maharashtra'),
  -- Manipur
  ('Bishnupur','Manipur'),('Chandel','Manipur'),('Churachandpur','Manipur'),
  ('Imphal East','Manipur'),('Imphal West','Manipur'),('Jiribam','Manipur'),
  ('Kakching','Manipur'),('Kamjong','Manipur'),('Kangpokpi','Manipur'),
  ('Noney','Manipur'),('Pherzawl','Manipur'),('Senapati','Manipur'),
  ('Tamenglong','Manipur'),('Tengnoupal','Manipur'),('Thoubal','Manipur'),('Ukhrul','Manipur'),
  -- Meghalaya
  ('East Garo Hills','Meghalaya'),('East Jaintia Hills','Meghalaya'),
  ('East Khasi Hills','Meghalaya'),('Eastern West Khasi Hills','Meghalaya'),
  ('North Garo Hills','Meghalaya'),('Ri Bhoi','Meghalaya'),('South Garo Hills','Meghalaya'),
  ('South West Garo Hills','Meghalaya'),('South West Khasi Hills','Meghalaya'),
  ('West Garo Hills','Meghalaya'),('West Jaintia Hills','Meghalaya'),
  ('West Khasi Hills','Meghalaya'),
  -- Mizoram
  ('Aizawl','Mizoram'),('Champhai','Mizoram'),('Hnahthial','Mizoram'),
  ('Khawzawl','Mizoram'),('Kolasib','Mizoram'),('Lawngtlai','Mizoram'),
  ('Lunglei','Mizoram'),('Mamit','Mizoram'),('Saitual','Mizoram'),
  ('Serchhip','Mizoram'),('Siaha','Mizoram'),
  -- Nagaland
  ('Chumoukedima','Nagaland'),('Dimapur','Nagaland'),('Kiphire','Nagaland'),
  ('Kohima','Nagaland'),('Longleng','Nagaland'),('Mokokchung','Nagaland'),
  ('Mon','Nagaland'),('Niuland','Nagaland'),('Noklak','Nagaland'),('Peren','Nagaland'),
  ('Phek','Nagaland'),('Shamator','Nagaland'),('Tseminyu','Nagaland'),
  ('Tuensang','Nagaland'),('Wokha','Nagaland'),('Zunheboto','Nagaland'),
  -- Odisha
  ('Angul','Odisha'),('Balangir','Odisha'),('Balasore','Odisha'),('Bargarh','Odisha'),
  ('Bhadrak','Odisha'),('Boudh','Odisha'),('Cuttack','Odisha'),('Deogarh','Odisha'),
  ('Dhenkanal','Odisha'),('Gajapati','Odisha'),('Ganjam','Odisha'),
  ('Jagatsinghpur','Odisha'),('Jajpur','Odisha'),('Jharsuguda','Odisha'),
  ('Kalahandi','Odisha'),('Kandhamal','Odisha'),('Kendrapara','Odisha'),
  ('Kendujhar','Odisha'),('Khordha','Odisha'),('Koraput','Odisha'),
  ('Malkangiri','Odisha'),('Mayurbhanj','Odisha'),('Nabarangpur','Odisha'),
  ('Nayagarh','Odisha'),('Nuapada','Odisha'),('Puri','Odisha'),('Rayagada','Odisha'),
  ('Sambalpur','Odisha'),('Subarnapur','Odisha'),('Sundargarh','Odisha'),
  -- Punjab
  ('Amritsar','Punjab'),('Barnala','Punjab'),('Bathinda','Punjab'),('Faridkot','Punjab'),
  ('Fatehgarh Sahib','Punjab'),('Fazilka','Punjab'),('Ferozepur','Punjab'),
  ('Gurdaspur','Punjab'),('Hoshiarpur','Punjab'),('Jalandhar','Punjab'),
  ('Kapurthala','Punjab'),('Ludhiana','Punjab'),('Malerkotla','Punjab'),('Mansa','Punjab'),
  ('Moga','Punjab'),('Mohali','Punjab'),('Muktsar','Punjab'),('Nawanshahr','Punjab'),
  ('Pathankot','Punjab'),('Patiala','Punjab'),('Rupnagar','Punjab'),
  ('Sangrur','Punjab'),('Tarn Taran','Punjab'),
  -- Rajasthan
  ('Ajmer','Rajasthan'),('Alwar','Rajasthan'),('Banswara','Rajasthan'),('Baran','Rajasthan'),
  ('Barmer','Rajasthan'),('Bharatpur','Rajasthan'),('Bhilwara','Rajasthan'),
  ('Bikaner','Rajasthan'),('Bundi','Rajasthan'),('Chittorgarh','Rajasthan'),
  ('Churu','Rajasthan'),('Dausa','Rajasthan'),('Dholpur','Rajasthan'),
  ('Dungarpur','Rajasthan'),('Hanumangarh','Rajasthan'),('Jaipur','Rajasthan'),
  ('Jaisalmer','Rajasthan'),('Jalore','Rajasthan'),('Jhalawar','Rajasthan'),
  ('Jhunjhunu','Rajasthan'),('Jodhpur','Rajasthan'),('Karauli','Rajasthan'),
  ('Kota','Rajasthan'),('Nagaur','Rajasthan'),('Pali','Rajasthan'),
  ('Pratapgarh','Rajasthan'),('Rajsamand','Rajasthan'),('Sawai Madhopur','Rajasthan'),
  ('Sikar','Rajasthan'),('Sirohi','Rajasthan'),('Sri Ganganagar','Rajasthan'),
  ('Tonk','Rajasthan'),('Udaipur','Rajasthan'),
  -- Sikkim
  ('East Sikkim','Sikkim'),('North Sikkim','Sikkim'),('Pakyong','Sikkim'),
  ('Soreng','Sikkim'),('South Sikkim','Sikkim'),('West Sikkim','Sikkim'),
  -- Tamil Nadu
  ('Ariyalur','Tamil Nadu'),('Chengalpattu','Tamil Nadu'),('Chennai','Tamil Nadu'),
  ('Coimbatore','Tamil Nadu'),('Cuddalore','Tamil Nadu'),('Dharmapuri','Tamil Nadu'),
  ('Dindigul','Tamil Nadu'),('Erode','Tamil Nadu'),('Kallakurichi','Tamil Nadu'),
  ('Kancheepuram','Tamil Nadu'),('Kanyakumari','Tamil Nadu'),('Karur','Tamil Nadu'),
  ('Krishnagiri','Tamil Nadu'),('Madurai','Tamil Nadu'),('Mayiladuthurai','Tamil Nadu'),
  ('Nagapattinam','Tamil Nadu'),('Namakkal','Tamil Nadu'),('Nilgiris','Tamil Nadu'),
  ('Perambalur','Tamil Nadu'),('Pudukkottai','Tamil Nadu'),('Ramanathapuram','Tamil Nadu'),
  ('Ranipet','Tamil Nadu'),('Salem','Tamil Nadu'),('Sivaganga','Tamil Nadu'),
  ('Tenkasi','Tamil Nadu'),('Thanjavur','Tamil Nadu'),('Theni','Tamil Nadu'),
  ('Thoothukudi','Tamil Nadu'),('Tiruchirappalli','Tamil Nadu'),('Tirunelveli','Tamil Nadu'),
  ('Tirupathur','Tamil Nadu'),('Tiruppur','Tamil Nadu'),('Tiruvallur','Tamil Nadu'),
  ('Tiruvannamalai','Tamil Nadu'),('Tiruvarur','Tamil Nadu'),('Vellore','Tamil Nadu'),
  ('Viluppuram','Tamil Nadu'),('Virudhunagar','Tamil Nadu'),
  -- Telangana
  ('Adilabad','Telangana'),('Bhadradri Kothagudem','Telangana'),('Hanumakonda','Telangana'),
  ('Hyderabad','Telangana'),('Jagtial','Telangana'),('Jangaon','Telangana'),
  ('Jayashankar Bhupalpally','Telangana'),('Jogulamba Gadwal','Telangana'),
  ('Kamareddy','Telangana'),('Karimnagar','Telangana'),('Khammam','Telangana'),
  ('Kumuram Bheem','Telangana'),('Mahabubabad','Telangana'),('Mahabubnagar','Telangana'),
  ('Mancherial','Telangana'),('Medak','Telangana'),('Medchal-Malkajgiri','Telangana'),
  ('Mulugu','Telangana'),('Nagarkurnool','Telangana'),('Nalgonda','Telangana'),
  ('Narayanpet','Telangana'),('Nirmal','Telangana'),('Nizamabad','Telangana'),
  ('Peddapalli','Telangana'),('Rajanna Sircilla','Telangana'),('Rangareddy','Telangana'),
  ('Sangareddy','Telangana'),('Siddipet','Telangana'),('Suryapet','Telangana'),
  ('Vikarabad','Telangana'),('Wanaparthy','Telangana'),('Warangal','Telangana'),
  ('Yadadri Bhuvanagiri','Telangana'),
  -- Tripura
  ('Dhalai','Tripura'),('Gomati','Tripura'),('Khowai','Tripura'),('North Tripura','Tripura'),
  ('Sepahijala','Tripura'),('South Tripura','Tripura'),('Unakoti','Tripura'),
  ('West Tripura','Tripura'),
  -- Uttar Pradesh
  ('Agra','Uttar Pradesh'),('Aligarh','Uttar Pradesh'),('Ambedkar Nagar','Uttar Pradesh'),
  ('Amethi','Uttar Pradesh'),('Amroha','Uttar Pradesh'),('Auraiya','Uttar Pradesh'),
  ('Ayodhya','Uttar Pradesh'),('Azamgarh','Uttar Pradesh'),('Baghpat','Uttar Pradesh'),
  ('Bahraich','Uttar Pradesh'),('Ballia','Uttar Pradesh'),('Balrampur','Uttar Pradesh'),
  ('Banda','Uttar Pradesh'),('Barabanki','Uttar Pradesh'),('Bareilly','Uttar Pradesh'),
  ('Basti','Uttar Pradesh'),('Bhadohi','Uttar Pradesh'),('Bijnor','Uttar Pradesh'),
  ('Budaun','Uttar Pradesh'),('Bulandshahr','Uttar Pradesh'),('Chandauli','Uttar Pradesh'),
  ('Chitrakoot','Uttar Pradesh'),('Deoria','Uttar Pradesh'),('Etah','Uttar Pradesh'),
  ('Etawah','Uttar Pradesh'),('Farrukhabad','Uttar Pradesh'),('Fatehpur','Uttar Pradesh'),
  ('Firozabad','Uttar Pradesh'),('Gautam Buddha Nagar','Uttar Pradesh'),
  ('Ghaziabad','Uttar Pradesh'),('Ghazipur','Uttar Pradesh'),('Gonda','Uttar Pradesh'),
  ('Gorakhpur','Uttar Pradesh'),('Hamirpur','Uttar Pradesh'),('Hapur','Uttar Pradesh'),
  ('Hardoi','Uttar Pradesh'),('Hathras','Uttar Pradesh'),('Jalaun','Uttar Pradesh'),
  ('Jaunpur','Uttar Pradesh'),('Jhansi','Uttar Pradesh'),('Kannauj','Uttar Pradesh'),
  ('Kanpur Dehat','Uttar Pradesh'),('Kanpur Nagar','Uttar Pradesh'),
  ('Kasganj','Uttar Pradesh'),('Kaushambi','Uttar Pradesh'),('Kheri','Uttar Pradesh'),
  ('Kushinagar','Uttar Pradesh'),('Lalitpur','Uttar Pradesh'),('Lucknow','Uttar Pradesh'),
  ('Maharajganj','Uttar Pradesh'),('Mahoba','Uttar Pradesh'),('Mainpuri','Uttar Pradesh'),
  ('Mathura','Uttar Pradesh'),('Mau','Uttar Pradesh'),('Meerut','Uttar Pradesh'),
  ('Mirzapur','Uttar Pradesh'),('Moradabad','Uttar Pradesh'),('Muzaffarnagar','Uttar Pradesh'),
  ('Pilibhit','Uttar Pradesh'),('Pratapgarh','Uttar Pradesh'),('Prayagraj','Uttar Pradesh'),
  ('Rae Bareli','Uttar Pradesh'),('Rampur','Uttar Pradesh'),('Saharanpur','Uttar Pradesh'),
  ('Sambhal','Uttar Pradesh'),('Sant Kabir Nagar','Uttar Pradesh'),
  ('Shahjahanpur','Uttar Pradesh'),('Shamli','Uttar Pradesh'),('Shravasti','Uttar Pradesh'),
  ('Siddharthnagar','Uttar Pradesh'),('Sitapur','Uttar Pradesh'),('Sonbhadra','Uttar Pradesh'),
  ('Sultanpur','Uttar Pradesh'),('Unnao','Uttar Pradesh'),('Varanasi','Uttar Pradesh'),
  -- Uttarakhand
  ('Almora','Uttarakhand'),('Bageshwar','Uttarakhand'),('Chamoli','Uttarakhand'),
  ('Champawat','Uttarakhand'),('Dehradun','Uttarakhand'),('Haridwar','Uttarakhand'),
  ('Nainital','Uttarakhand'),('Pauri Garhwal','Uttarakhand'),('Pithoragarh','Uttarakhand'),
  ('Rudraprayag','Uttarakhand'),('Tehri Garhwal','Uttarakhand'),
  ('Udham Singh Nagar','Uttarakhand'),('Uttarkashi','Uttarakhand'),
  -- West Bengal
  ('Alipurduar','West Bengal'),('Bankura','West Bengal'),('Birbhum','West Bengal'),
  ('Cooch Behar','West Bengal'),('Dakshin Dinajpur','West Bengal'),
  ('Darjeeling','West Bengal'),('Hooghly','West Bengal'),('Howrah','West Bengal'),
  ('Jalpaiguri','West Bengal'),('Jhargram','West Bengal'),('Kalimpong','West Bengal'),
  ('Kolkata','West Bengal'),('Malda','West Bengal'),('Murshidabad','West Bengal'),
  ('Nadia','West Bengal'),('North 24 Parganas','West Bengal'),
  ('Paschim Bardhaman','West Bengal'),('Paschim Medinipur','West Bengal'),
  ('Purba Bardhaman','West Bengal'),('Purba Medinipur','West Bengal'),
  ('Purulia','West Bengal'),('South 24 Parganas','West Bengal'),
  ('Uttar Dinajpur','West Bengal'),
  -- Delhi
  ('Central Delhi','Delhi'),('East Delhi','Delhi'),('New Delhi','Delhi'),
  ('North Delhi','Delhi'),('North East Delhi','Delhi'),('North West Delhi','Delhi'),
  ('Shahdara','Delhi'),('South Delhi','Delhi'),('South East Delhi','Delhi'),
  ('South West Delhi','Delhi'),('West Delhi','Delhi'),
  -- Jammu and Kashmir
  ('Anantnag','Jammu and Kashmir'),('Bandipora','Jammu and Kashmir'),
  ('Baramulla','Jammu and Kashmir'),('Budgam','Jammu and Kashmir'),
  ('Doda','Jammu and Kashmir'),('Ganderbal','Jammu and Kashmir'),
  ('Jammu','Jammu and Kashmir'),('Kathua','Jammu and Kashmir'),
  ('Kishtwar','Jammu and Kashmir'),('Kulgam','Jammu and Kashmir'),
  ('Kupwara','Jammu and Kashmir'),('Poonch','Jammu and Kashmir'),
  ('Pulwama','Jammu and Kashmir'),('Rajouri','Jammu and Kashmir'),
  ('Ramban','Jammu and Kashmir'),('Reasi','Jammu and Kashmir'),
  ('Samba','Jammu and Kashmir'),('Shopian','Jammu and Kashmir'),
  ('Srinagar','Jammu and Kashmir'),('Udhampur','Jammu and Kashmir'),
  -- Ladakh
  ('Kargil','Ladakh'),('Leh','Ladakh'),
  -- Andaman and Nicobar Islands
  ('Nicobar','Andaman and Nicobar Islands'),
  ('North and Middle Andaman','Andaman and Nicobar Islands'),
  ('South Andaman','Andaman and Nicobar Islands'),
  -- Chandigarh
  ('Chandigarh','Chandigarh'),
  -- Dadra and Nagar Haveli and Daman and Diu
  ('Dadra and Nagar Haveli','Dadra and Nagar Haveli and Daman and Diu'),
  ('Daman','Dadra and Nagar Haveli and Daman and Diu'),
  ('Diu','Dadra and Nagar Haveli and Daman and Diu'),
  -- Lakshadweep
  ('Lakshadweep','Lakshadweep'),
  -- Puducherry
  ('Karaikal','Puducherry'),('Mahe','Puducherry'),
  ('Puducherry','Puducherry'),('Yanam','Puducherry')
) AS d(district_name, state_name) ON us.state_name = d.state_name
ON CONFLICT DO NOTHING;

-- Summary
SELECT s.state_name, COUNT(d.id) AS districts
FROM states s
LEFT JOIN districts d ON d.state_id = s.id
WHERE s.country_id = (SELECT id FROM countries WHERE country_code = 'IN' LIMIT 1)
GROUP BY s.state_name
ORDER BY s.state_name;
