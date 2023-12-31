
from sys import argv
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

_, public_key, user_agent = argv

chrome_options = uc.ChromeOptions()
chrome_options.headless = False
chrome_options.add_argument(f'--user-agent={user_agent}')

driver = uc.Chrome(options=chrome_options, version_main=113)

driver.get('https://nekto.me/chat/#/')

driver.execute_script('window.stop()')
driver.execute_script(f"""
 document.write(`<html>
    <head>
      <script>
        var render = (token) => document.body.insertAdjacentHTML('afterend', '<output>' + token + '</output>');
      </script>
    </head>
    <body>
        <div class="g-recaptcha" data-sitekey="{public_key}" data-callback="render"></div>
        <script src="https://www.google.com/recaptcha/api.js" ></script>
    </body>
  </html>
 `)
""")

driver.implicitly_wait(32)

driver.switch_to.frame(driver.find_element(By.TAG_NAME, 'iframe'))
driver.find_element(By.ID, 'recaptcha-anchor').click()

driver.switch_to.parent_frame()
solution = driver.find_element(By.TAG_NAME, 'output').text

print(solution)

driver.quit()