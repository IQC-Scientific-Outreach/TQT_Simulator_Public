import usb.core
import usb.util
import time

VENDOR_ID = 0x0bd0
PRODUCT_ID = 0xf100
EP_OUT = 0x02
EP_IN = 0x81

def scan_protocols():
    dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
    if dev is None:
        print("Device not found")
        return
    
    dev.set_configuration()
    print("✅ Connected. Scanning common commands...\n")

    # List of things to try
    # Many physics devices want "\r\n" (Carriage Return + Newline)
    commands = ["*IDN?", "VERSION", "?", "HELP", "ver", "id"]
    terminators = ["\n", "\r\n", "\r"]

    for cmd_text in commands:
        for term in terminators:
            full_cmd = cmd_text + term
            print(f"Trying: {repr(full_cmd)} ... ", end="", flush=True)

            try:
                # 1. Clear the Read Buffer (Eat any old garbage data)
                try:
                    dev.read(EP_IN, 1024, 100) 
                except:
                    pass 

                # 2. Write
                dev.write(EP_OUT, full_cmd.encode('ascii'))

                # 3. Read
                response = dev.read(EP_IN, 64, 500) # 500ms timeout
                
                # 4. Print Raw and Text
                raw_bytes = list(response)
                text = "".join([chr(x) for x in raw_bytes if 32 <= x <= 126]) # Only printable chars
                
                print(f"✅ REPLY!")
                print(f"   -> Raw Bytes: {raw_bytes}")
                print(f"   -> As Text:   '{text}'")
                return # Stop if we find something!

            except usb.core.USBError:
                print("❌ No Reply (Timeout)")
                pass
            
            time.sleep(0.1)

    print("\n--- Scan Complete ---")
    print("If all failed, the device likely uses a BINARY protocol (not text).")

if __name__ == "__main__":
    scan_protocols()