<# 
    Nordisk Auto - Finn.no Data Fetcher
    Henter bildata fra Finn.no API og lagrer som JSON
    Kjør dette scriptet regelmessig for å oppdatere bilene på nettsiden
#>

$orgId = "1031027521"
$apiUrl = "https://www.finn.no/api/search-qf?searchkey=SEARCH_ID_CAR_USED&orgId=$orgId&vertical=car"
$outputPath = Join-Path $PSScriptRoot "data\cars.json"

Write-Host "Henter biler fra Finn.no API for Nordisk Auto..." -ForegroundColor Cyan
Write-Host "API URL: $apiUrl" -ForegroundColor Gray

try {
    # Hent data fra Finn.no API
    $headers = @{
        "Accept" = "application/json"
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    $response = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers $headers
    
    Write-Host "API-respons mottatt. Behandler data..." -ForegroundColor Yellow
    
    if ($response.docs -and $response.docs.Count -gt 0) {
        $cars = @()
        
        foreach ($doc in $response.docs) {
            # Ekstraher merke og modell direkte fra API-responsen
            $heading = $doc.heading
            
            $brand = if ($doc.make) { $doc.make } else { ($heading -split ' ')[0] }
            $model = if ($doc.model) { $doc.model } else { $heading -replace "^$brand\s*", "" }
            
            # Hent drivstofftype direkte fra 'fuel'-feltet
            $fuelType = $doc.fuel
            
            # Map drivstofftype til filterType
            $filterType = switch -Regex ($fuelType) {
                "^El$|^Elektrisk$|^Electric$" { "el" }
                "Hybrid|Plug-in|PHEV|plugin_hybrid|hybrid_petrol|hybrid_diesel" { "hybrid" }
                "^Bensin$|^Petrol$" { "bensin" }
                "^Diesel$" { "diesel" }
                default { "bensin" }  # Fallback
            }
            
            # Normaliser fuelType for visning
            if ($filterType -eq "el") { $fuelType = "Elektrisk" }
            
            # Hvis fuel er null, gjett basert på modellnavn
            if (-not $fuelType) {
                $headingLower = $heading.ToLower()
                if ($headingLower -match "tesla|model 3|model s|model x|model y|e-nv200|leaf|ioniq 5|ioniq 6|ev6|ev9|id\.|enyaq|e-tron|i3|i4|ix|eqs|eqe|c40|polestar|taycan|nio|zs ev|kona electric|mg4|mg5") {
                    $filterType = "el"
                    $fuelType = "Elektrisk"
                } elseif ($headingLower -match "ampera|hybrid|phev|plug-in|prius|yaris hybrid|c-hr hybrid|rav4 hybrid|niro hybrid") {
                    $filterType = "hybrid"
                    $fuelType = "Hybrid"
                } elseif ($headingLower -match "tdi|cdi|hdi|d4|d5|dci|bluehdi|cdti|crdi|diesel") {
                    $filterType = "diesel"
                    $fuelType = "Diesel"
                } else {
                    $filterType = "bensin"
                    $fuelType = "Bensin"
                }
            }
            
            # Hent andre attributter
            $transmission = $doc.transmission
            $horsepower = $null
            
            # Hent bilde-URL
            $imageUrl = "assets/images/placeholder.jpg"
            if ($doc.image -and $doc.image.url) {
                $imageUrl = $doc.image.url
            } elseif ($doc.images -and $doc.images.Count -gt 0) {
                $imageUrl = $doc.images[0].url
            }
            
            # Formater kilometerstand
            $mileage = "Ukjent"
            if ($doc.mileage) {
                $mileage = "{0:N0} km" -f $doc.mileage
            }
            
            # Formater pris
            $price = 0
            $priceFormatted = "Pris mangler"
            if ($doc.price -and $doc.price.amount) {
                $price = $doc.price.amount
                $priceFormatted = "{0:N0}" -f $price
            }
            
            # Hent rekkevidde for elbiler
            $range = $null
            if ($doc.range_km) {
                $range = "$($doc.range_km) km"
            }
            
            $car = @{
                id = $doc.ad_id
                brand = $brand
                model = $model
                title = $heading
                year = $doc.year
                mileage = $mileage
                price = $price
                priceFormatted = $priceFormatted
                image = $imageUrl
                fuelType = $fuelType
                filterType = $filterType
                transmission = $transmission
                horsepower = $horsepower
                location = $doc.location
                range = $range
                finnUrl = "https://www.finn.no/mobility/item/$($doc.ad_id)"
            }
            
            $cars += $car
        }
        
        # Lag statistikk
        $stats = @{
            total = $cars.Count
            electric = ($cars | Where-Object { $_.filterType -eq "el" }).Count
            hybrid = ($cars | Where-Object { $_.filterType -eq "hybrid" }).Count
            petrol = ($cars | Where-Object { $_.filterType -eq "bensin" }).Count
            diesel = ($cars | Where-Object { $_.filterType -eq "diesel" }).Count
        }
        
        $output = @{
            lastUpdated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            stats = $stats
            cars = $cars
        }
        
        # Sørg for at data-mappen eksisterer
        $dataFolder = Join-Path $PSScriptRoot "data"
        if (-not (Test-Path $dataFolder)) {
            New-Item -ItemType Directory -Path $dataFolder -Force | Out-Null
        }
        
        $output | ConvertTo-Json -Depth 10 | Set-Content $outputPath -Encoding UTF8
        
        Write-Host ""
        Write-Host "=== SUKSESS ===" -ForegroundColor Green
        Write-Host "Hentet $($cars.Count) biler fra Finn.no" -ForegroundColor Green
        Write-Host ""
        Write-Host "Statistikk:" -ForegroundColor Cyan
        Write-Host "  Elbiler:  $($stats.electric)" -ForegroundColor Yellow
        Write-Host "  Hybrid:   $($stats.hybrid)" -ForegroundColor Yellow
        Write-Host "  Bensin:   $($stats.petrol)" -ForegroundColor Yellow
        Write-Host "  Diesel:   $($stats.diesel)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Data lagret til: $outputPath" -ForegroundColor Cyan
        
    } else {
        Write-Host "Ingen biler funnet i API-responsen." -ForegroundColor Red
        Write-Host "Response keys: $($response.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
        
        # Debug: Vis hele responsen
        Write-Host "Full respons:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 2 | Write-Host
    }
    
} catch {
    Write-Host "Feil ved henting av data: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Sjekk at du har internettilgang og at Finn.no er tilgjengelig." -ForegroundColor Yellow
}
