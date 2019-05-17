# app_name to pi_name mapper
bank_to_pi = {'SBI': ('SBIDC', 'SBICC', 'SBINB'),
              'HDFC': ('HDFC', 'HDFCNB', 'HDFCIVR'),
              'AXIS': ('AXIS', 'AXISNB'),
              'KOTAK': ('KOTAK', 'KOTAKDC', 'KOTAKCC', 'KOTAKNB'),
              'CANARA': ('CANARA', 'CANARANB'),
              'ICICI': ('ICICIDC', 'ICICICC', 'ICICINB', 'ICICIQC', 'ICICI_ATM'),
              'BOB': ('BOBDC', 'BOBNB'),
              'CITI': ('CITI', 'CITINB'),
              'CORP': ('CORPDC', 'CORPCC', 'CORP CARD', 'CORPNB'),
              'PNB': ('PNBDC', 'PNBNB ')}

pg_name_map = {'HDFC PG': ('HDFC PG','HDFC') }

#merchant_list for bank dashboard
preffered_merchants = ('snapdeal','bms','foodpanda','myairtel',\
					 'Myntra','com.swiggy','oxigen')

#pg _funnel_ type list
funnel_type = ['All', 'ON_US', 'OFF_US']

#list of dupilcate app_name in client dropdown
app_name_map = [('FreeCharge','Freecharge'),\
				('BookMyShow','bookmyshow','BMS'),('Voonik','Mr Voonik','Vilara')]

#list of dummy merchant_id for pg/bank dash
merchant_dummyfy = [('merchant_1','bms'),
				  ('merchant_2','snapdeal'),
				  ('merchant_3','Myntra'),
				  ('merchant_4','foodpanda'),
				  ('merchant_5','com.swiggy'),
				  ('merchant_6','oxigen'),
				  ('merchant_7','myairtel')]


jwt_key = {'development':'signit','production':'zLqVNxxuqPbA6DGZ3QucZAD46eUi'}

#list of columns to be STRING(column) in big query
to_str_columns = ['run_week','run_month']
